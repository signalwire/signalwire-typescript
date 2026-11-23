# Operations

An operations agent is written as what it can do for a caller. You write each operation once, for any caller: its fields, its rules and its writes. The SDK runs everything else the same way for every operation: finding the caller's account, reading each change back, taking the caller's yes, carrying the change out, and keeping the call's record. The helpers are in `@signalwire/sdk/operations`.

## Table of Contents

- [A Store in One Page](#a-store-in-one-page)
- [Operations](#operations)
- [The Change Lifecycle](#the-change-lifecycle)
- [A Request While a Change Waits](#a-request-while-a-change-waits)
- [Identifying the Caller](#identifying-the-caller)
- [Lookups](#lookups)
- [Money](#money)
- [Appointments and Messages](#appointments-and-messages)
- [Payments](#payments)
- [A Front Desk and a Personal Assistant](#a-front-desk-and-a-personal-assistant)
- [Outbound Calls](#outbound-calls)
- [What the SDK Generates](#what-the-sdk-generates)
- [The Call's Record](#the-calls-record)
- [Words, Languages and the Medium](#words-languages-and-the-medium)
- [Games, Kiosks and Screens](#games-kiosks-and-screens)
- [Installing on Your Own Agent](#installing-on-your-own-agent)
- [Two Services on One Agent](#two-services-on-one-agent)
- [InfoBot: Answering From a Corpus](#infobot-answering-from-a-corpus)
- [Testing](#testing)

## A Store in One Page

```ts
import assert from 'node:assert/strict';
import { CallSimulator } from '@signalwire/sdk';
import {
  type CallContext,
  Change,
  Field,
  Operation,
  Refuse,
  ServiceAgent,
  type Values,
  Write,
} from '@signalwire/sdk/operations';

const ORDERS: Record<string, { status: string; total: number }> = {
  '#W1': { status: 'pending', total: 54.04 },
  '#W2': { status: 'delivered', total: 20.0 },
};
const WRITES: [string, Record<string, unknown>][] = [];

const agent = new ServiceAgent({
  name: 'store',
  role: 'You answer the phone for an online store. You are warm, brief and plain-spoken.',
  currency: 'USD',
});
agent.identify({
  anyOf: [['email']],
  find: (_call, keys) => (keys['email'] === 'ann@example.com' ? 'u1' : null),
  describe: () => 'Ann; orders #W1 (pending) and #W2 (delivered)',
});
agent.writesWith((_call, write) => {
  WRITES.push([write.name, write.args]);
});

agent.lookup("An order's status and total.", {
  fields: { order_id: new Field('string', "The order's id.") },
})(function order_details(_call, { order_id }) {
  const order = ORDERS[String(order_id)];
  if (order === undefined) throw new Refuse(`${String(order_id)} isn't one of their orders.`);
  return `${String(order_id)} is ${order.status}; total $${order.total.toFixed(2)}.`;
});

class Cancel extends Operation {
  static override description = 'Cancel a pending order.';
  order_id = new Field('string', 'The order to cancel.');
  reason = new Field(['no longer needed', 'ordered by mistake'], "Why they're cancelling.", {
    ask: 'Why are they cancelling it?',
  });

  override prepare(_call: CallContext, f: Values): Change {
    const id = String(f['order_id']);
    const order = ORDERS[id];
    if (order === undefined || order.status !== 'pending') {
      throw new Refuse(`${id} can't be cancelled: only pending orders can.`);
    }
    return new Change({
      readBack: `Cancel order ${id}, refunding $${order.total.toFixed(2)}. Shall I go ahead?`,
      touches: [`order:${id}`],
      writes: [new Write('cancel_order', { order_id: id, reason: f['reason'] })],
      money: [-order.total],
      done: `Order ${id} is cancelled.`,
    });
  }
}
agent.operation(Cancel, { tool: 'cancel_order' });

const call = new CallSimulator(agent);
await call.call('find_account', {
  email: 'ann@example.com',
  asked_for: 'cancel an order',
  data_supplied_by_user: true,
});
await call.call('cancel_order', {
  order_id: '#W1',
  reason: 'no longer needed',
  data_supplied_by_user: true,
});
assert.equal(call.step, 'confirm');
call.caller('Yes, please.');
const done = await call.call('confirm_change', { change: 'cancel' });
assert.equal(done.response, 'Done. Order #W1 is cancelled.');
assert.deepEqual(WRITES, [['cancel_order', { order_id: '#W1', reason: 'no longer needed' }]]);
```

That's the whole agent. Nothing above sets a step, a history mode, a gate or a global data key: the SDK generates them, the same for every operation.

## Operations

An operation is a class that extends `Operation`, with `Field` properties (their names are the tool's argument names), a `static description` (what it does, as the model reads it: the first paragraph is used) and `prepare(call, values)`. `call` is a `CallContext`: the request's record, the caller's account, your own state for the call, and ways to act on it. `values` gives each field as the model sent it, `values['order_id']`, or null when it wasn't given. `prepare` checks the request, may look things up (it may be async), and answers one of three ways:

| `prepare`                      | Meaning                           | What the SDK does                                                          |
| ------------------------------ | --------------------------------- | -------------------------------------------------------------------------- |
| returns a `Change`             | The request is valid and complete | Freezes it as the change waiting for a yes, and the platform reads it back |
| throws `new Need(ask)`         | Something wasn't said             | Tells the model what to ask; nothing is proposed                           |
| throws `new Refuse(why, then)` | The request breaks a rule         | Tells the model why and what can be done instead; nothing changes          |

Register it with `agent.operation(Cls, { tool, kind, guidance })`: the tool's name defaults to the class name in snake case, its kind (its name in the record and in `confirm_change`) to the class name in lower case. The class's other settings are statics: `combine`, `goesBefore`, `guidance`, `fillers`, `confirm`, `beforeIdentity`, `askInOrder`, `offeredIn` and `secure`.

A `Field` takes a kind (`'string'`, `'integer'`, `'number'`, `'boolean'`, a list of the values it can take, or a JSON schema object for anything else, such as `{ type: 'array', items: { type: 'string' } }`), a description, and `{ required, ask }`.

A `Change` carries `readBack` (the words the caller says yes to: put the change itself in the first clause), `touches` (stable keys for what it acts on, such as `order:#W1`), `writes` (the backend writes, kept as data), `money` (what each write moves, and `currency`, see [Money](#money)) and `done` (what to tell the caller once each write went through).

`then` is what the model is told once a change is made, in place of everything the service would tell it ("Tell them it's done", and what's next), for a change whose effect comes after the tool's result, such as a payment the platform takes next.

A change that has to wait for another one the caller asked for names that one's kind in `after` (and why, in `afterWhy`): an item change that would leave the order's address unchangeable, while they've also asked to change the address. It isn't read back yet. It's set aside, the model is told to call that kind's tool now, and it's offered once a change of that kind is settled.

A field with `ask` is asked for when the model sends it empty, null or as "not said" (a field with a fixed choice of values gets that option), before `prepare` runs, so the model is never pushed to invent it. Every operation tool also has the caller vouch for its details (`data_supplied_by_user`), and nothing runs without that.

Writes run through the agent's writer (`writesWith`) or the operation's own `apply(call, write)`; either may be async. Throw `new WriteFailed(reason)` when the backend refuses one: the writes before it stay made, and the model is told exactly what went through. `call.writeKey` is unique to each write in the call, for backends that take an idempotency key.

## The Change Lifecycle

Every change goes through the same steps:

1. The model calls an operation's tool with everything the caller said.
2. `prepare` answers.
3. The change is frozen as the one waiting, and the platform reads it back. Its state is recorded ahead of the read-back, so a caller who talks over it doesn't lose it.
4. The model calls `confirm_change` or `decline_change`. `confirm_change` has one gate: did the caller agree to this read-back. A yes said while it was still being read counts.
5. The writes run in order, each outcome kept.
6. The change goes into the call's history, with the money it moved; after a second change that moves money, the model is told what the call comes to in all.
7. A change set aside for after this one is offered next; with none, the model is told to go on with anything else the caller asked for.

## A Request While a Change Waits

When the caller asks for something else while a change waits for their yes, the new request (N) is weighed against the one waiting (W) by what both touch:

| Case                                                                   | What happens                                                                                                                                               |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N is the same operation, made "as well", and `combine` allows it       | One change: `merge(W, N)`, read back as one                                                                                                                |
| N is the same operation for things W is for, and "as well" wasn't said | Nothing changes; the model is told to ask "as well, or instead?"                                                                                           |
| N is the same operation otherwise, or `conflictsWith` W                | N takes W's place for what both touch; the rest of W (`without`) is built again and set aside. If it can't go through without what N took, nothing changes |
| N conflicts with W and was asked for "as well"                         | Nothing changes; they can't have both, and the model is told why                                                                                           |
| W's operation lists N's kind in `goesBefore`                           | W stays waiting; N is set aside for right after                                                                                                            |
| Anything else                                                          | N is read back now; W is set aside for right after                                                                                                         |

A change set aside is weighed against the new one the same way. The hooks are the operation's: `static combine` (the fields that must match to merge), `merge(held, added)`, `conflictsWith(other, mine, theirs)`, `without(args, gone)` and `static goesBefore`.

```ts
import {
  type CallContext,
  Change,
  Field,
  Operation,
  ServiceAgent,
  type Values,
} from '@signalwire/sdk/operations';

const agent = new ServiceAgent({ name: 'returns', role: 'You handle returns and exchanges.' });

class Return extends Operation {
  static override description = 'Return items of a delivered order.';
  // "As well" merges when the refund goes to the same place
  static override combine = ['refund_to'];
  order_id = new Field('string', 'The delivered order.');
  items = new Field({ type: 'array', items: { type: 'string' } }, 'The items to return.');
  refund_to = new Field('string', 'Where the refund goes.');

  override prepare(_call: CallContext, f: Values): Change {
    const items = f['items'] as string[];
    return new Change({
      readBack: `Return ${items.join(', ')} from ${String(f['order_id'])}. Shall I?`,
      touches: [`order:${String(f['order_id'])}`, ...items.map((i) => `item:${i}`)],
    });
  }

  override conflictsWith(other: string, mine: Change, theirs: Change): string | null {
    if (other === 'exchange' && theirs.touches.includes(mine.touches[0]!)) {
      return 'a delivered order takes one return or one exchange, not both';
    }
    return null;
  }

  override without(args: Record<string, unknown>, gone: ReadonlySet<string>) {
    const items = ((args['items'] as string[] | undefined) ?? []).filter(
      (i) => !gone.has(`item:${i}`),
    );
    return items.length > 0 ? { ...args, items } : null;
  }
}
agent.operation(Return, { tool: 'return_items' });
```

## Identifying the Caller

`identify({ anyOf: [...], find })` adds a step and a tool that find the caller's account by any one of the key sets. `find(call, keys)` returns the account's id, or throws `Refuse` (not found, with what to ask next) or `Need`. `load(call, accountId)` gives operations the account as `call.account`; `describe(call)` puts it in a few words for the steps, and is read again after every change. Each may be async. What the caller asked for before they were identified (`asked_for`) is kept in the record. With `checkKeys: false`, `find` is called without a whole key set, for a search that recovers from misheard or spelled keys itself.

## Lookups

```ts
import { Field, ServiceAgent } from '@signalwire/sdk/operations';

const agent = new ServiceAgent({ name: 'info', role: 'You answer questions about the shop.' });
agent.lookup('Opening hours for a day.', {
  fields: { day: new Field('string', 'The day.') },
  beforeIdentity: true,
})(function hours(_call, { day }) {
  return `${String(day)}: 9 to 5.`;
});
```

A lookup reads and changes nothing. `lookup(description, opts)` returns a function that registers yours: it's called as `fn(call, args)`, with each of its `fields` (null when not given), and returns text or a `FunctionResult`, or throws `Refuse`. Its tool is named after the function unless `tool` names it. JavaScript functions don't carry their parameter names at run time, so give a lookup's arguments as `fields`. Lookups are offered once the caller is identified, unless `beforeIdentity: true`.

## Money

`Change.money` is what each write moves: more than 0 charged, less than 0 back to the caller. An amount can be a number, a bigint or a numeric string, and it's kept exactly, as a decimal string written as the reference's `Decimal` writes it (so "2.50" stays "2.50"). A number is read by its shortest decimal form, so 54.04 stays 54.04; a whole number has no float form in JavaScript, so -30.0 is "-30". `Change.currency` is its ISO 4217 code, such as `"EUR"`; `currency` on the service is the code for changes that don't give one. With no currency anywhere, amounts are stated without one.

After a second change that moves money, the model is told what the call comes to, for each currency apart: "$12.50 back to them and €5.00 charged". Amounts of different currencies are never added together.

`formatMoney(amount, currency)` writes an amount the way the model reads it: a symbol or code and the currency's own decimal places for the common currencies in `CURRENCIES` (`$54.04`, `€54.04`, `¥5,404`, `CA$12.00`, `KWD 1.235`), any other code after the amount (`54.04 XOF`), and a plain number with no currency. Use it in your own read-backs too. `moneyFormat: (amount, currency) => text` replaces it for the totals the service states; `amount` is an exact decimal string, never below 0, and `currency` is the code or null.

```ts
import assert from 'node:assert/strict';
import { ServiceAgent, formatMoney } from '@signalwire/sdk/operations';

const agent = new ServiceAgent({
  name: 'boutique',
  role: 'You answer the phone for a boutique in Lyon.',
  currency: 'EUR',
});
assert.equal(formatMoney(54.04, 'EUR'), '€54.04');
```

## Appointments and Messages

Two task packs add common operations to a service with `addTo`, against a backend of yours given as functions. Each has its own wording table, and `tools` or `tool` renames what it generates.

`Appointments` finds open times and books, moves and cancels the caller's appointments. `openings(call, when, kind)` returns the `Slot`s open near when they'd like it, in their words ("Tuesday afternoon"); `book(call, slot, kind, note)` books one once they've said yes; `booked(call)`, `move` and `cancel` work on their own `Appointment`s. Each may be async. A slot or an appointment comes with its `label`, how it's said ("Tuesday the 3rd at 2 pm"), and the pack never reads or writes a date itself: the time zone, the calendar and the language are yours. Only a slot it found open can be booked. Moving and cancelling the same appointment can't both happen, so one takes the other's place. With `beforeIdentity: true` a new customer can book before they're identified; their own appointments always need an account. The words are in `APPOINTMENTS_WORDING`.

`Messages` takes a message for someone, read back before it's passed on. `save(call, message)` gets a `Message` with the text, who it's from, a number to reach them, who it's for (one of `recipients`) and the call and account ids (`callId`, `accountId`). Without a number, it offers the one they're calling from, read back for them to agree to. A second message for the same person while the first waits takes its place, so a caller can change what it says. The words are in `MESSAGES_WORDING`.

```ts
import { Appointments, Messages, ServiceAgent, Slot } from '@signalwire/sdk/operations';

const OPEN: Record<string, string> = { s1: 'Tuesday at 2 pm', s2: 'Wednesday at 10 am' };
const agent = new ServiceAgent({
  name: 'dentist',
  role: 'You answer the phone for a dental practice.',
});
new Appointments({
  openings: () => Object.entries(OPEN).map(([id, label]) => new Slot(id, label)),
  book: (_call, slot) => {
    delete OPEN[slot.id];
  },
  kinds: ['cleaning', 'check-up'],
  beforeIdentity: true,
}).addTo(agent);
new Messages({
  save: (_call, message) => console.log(message),
  recipients: { 'Dr. Lee': 'the dentist' },
}).addTo(agent);
```

## Payments

`Payments` takes a card payment the caller agreed to, without the model ever hearing the card. The amount comes from your `charge(call, payingFor)` function, never from the model: the caller names what they're paying, such as an invoice, `charge` returns a `Charge` (the amount, what it's for, and its currency), and that's read back for their yes. Then the platform's pay verb takes the card on the keypad and charges it through your payment connector (`connectorUrl`). When it has finished, the model is told to call `payment_result`, which reads the outcome the platform recorded rather than anything the model says. A payment that went through goes into the call's history with its money; one that didn't charges nothing, and the model is told why. `onResult(call, result)` gets every `PaymentResult`, the platform's details included, for your records. A payment is taken on a call: in a chat, the tool says so and changes nothing.

The pack asks the platform to post the pay verb's variables with each tool request (`swaig_post_swml_vars`). A payment needs a currency, the `Charge`'s, the pack's or the service's, and a language for the card prompts, the pack's `language` or the agent's first; an agent with neither fails when it's set up. `reusable: true` asks for a token the connector can charge again. Its words are in `PAYMENTS_WORDING`.

```ts
import { Charge, Payments, ServiceAgent } from '@signalwire/sdk/operations';

const BALANCES: Record<string, string> = { '1042': '54.04' };
const agent = new ServiceAgent({
  name: 'billing',
  role: 'You take payments for a water utility.',
  currency: 'USD',
});
agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rime.spore' });
new Payments({
  connectorUrl: 'https://pay.example.com/connector',
  charge: (_call, invoice) => new Charge(BALANCES[invoice]!, `invoice ${invoice}`),
}).addTo(agent);
```

## A Front Desk and a Personal Assistant

Two prefabs put the packs together. Each is a `ServiceAgent`, and takes its options.

`FrontDeskAgent` is a business's front desk. `departments` are where callers can be put through to, each a `Department` with what callers go to it for, where the call goes, and an optional `open(call)`: while a department isn't taking calls, the caller is told so and offered a message. `appointments`, `messages` and `knowledge` (an `InfoBotKnowledge`, offered before the caller is identified) are each used when given. Its own words are in `FrontDeskAgent.WORDING`, and `deskWording` replaces them.

`PersonalAssistantAgent` answers the phone for one person. It asks who's calling and what it's about, then puts the call through: the person's phone rings, and once they answer they hear a whisper ("Bo is calling about the contract. Press 1 to take the call."). The caller hears ringing meanwhile. If the person presses the key (`acceptKey`, 1 unless set), the calls are joined, and the caller's call ends when theirs does. If they don't answer or don't take it, the assistant carries on with the caller and offers a message or a time on their calendar, from `messages` and `appointments`. `available(call)` keeps the call from ringing them when they aren't taking calls. `ringSeconds`, `answerSeconds`, `whisperVoice` and `whisperLanguage` set the ringing and the whisper. In a chat nobody is put through, by either prefab: the caller is told, and offered a message or a time instead. Its own words are in `PersonalAssistantAgent.WORDING`.

```ts
import { Department, FrontDeskAgent, PersonalAssistantAgent } from '@signalwire/sdk';
import { Messages } from '@signalwire/sdk/operations';

const desk = new FrontDeskAgent({
  role: 'You answer the phone for Bayside Dental. You are warm and brief.',
  departments: { billing: new Department('questions about a bill', '+15550100001') },
  messages: new Messages({ save: (_call, message) => console.log(message) }),
});
const assistant = new PersonalAssistantAgent({
  role: "You answer Ann Lee's phone. You are friendly and brief.",
  owner: 'Ann',
  reach: '+15550100002',
  messages: new Messages({ save: (_call, message) => console.log(message) }),
});
```

`ConciergeAgent`, `ReceptionistAgent` and `FAQBotAgent` still work, and are deprecated: each warns once when made, naming its replacement. Use `FrontDeskAgent`, and `InfoBotKnowledge` for answers.

## Outbound Calls

`Dialer` places a call to an agent only once every check passes, and otherwise throws `NotPlaced` with the reason and makes no request. It takes `url`, the agent the call runs, or `swml`, a SWML document to run instead, and exactly one of them. A `Callee` carries the number, the callee's own time zone (an IANA name) and what the call is about, which goes to the agent as query parameters of its URL. `consented(lookup)` stops a call with no consent on record or consent withdrawn; `callingHours(start, end, { days })` stops one outside the hours (`'09:00'`, `'20:30'`), read on the callee's own clock. A check of your own is `check(callee, now)` returning a reason or null; `now` is a `Date`. `whyNot(callee)` says what would stop a call without placing it. Pacing, retries and outcomes are your scheduler's: call `place` from it, with `statusUrl` for the call's progress.

<!-- snippet: no-run places a real outbound call: it needs a project, its credentials and a number to call -->

```ts
import { RestClient } from '@signalwire/sdk';
import { Callee, Dialer, NotPlaced, callingHours, consented } from '@signalwire/sdk/operations';

const CONSENT: Record<string, boolean> = { '+15557654321': true };
const dialer = new Dialer(new RestClient(), {
  // SIGNALWIRE_PROJECT_ID, SIGNALWIRE_API_TOKEN, SIGNALWIRE_SPACE
  fromNumber: '+15550001111',
  url: 'https://agents.example.com/reminders',
  checks: [consented((callee) => CONSENT[callee.number]), callingHours('09:00', '20:00')],
});
try {
  await dialer.place(new Callee('+15557654321', 'America/Los_Angeles', { appointment: 'a1' }));
} catch (e) {
  if (e instanceof NotPlaced) console.log(e.reason);
  else throw e;
}
```

## What the SDK Generates

- Steps: `identify` (with `identify`), `main`, `confirm`, a step per operation with `guidance`, each declared phase, and `transferred` (with `transferWith`). Handlers move between them; the model never navigates. The steps after identify, but for `transferred`, which offers none, offer every operation tool and every lookup (an operation's `offeredIn` and a phase's own tool list narrow that), so a caller who asks for something else is never stranded; the identify step offers the identify tool and what's `beforeIdentity`.
- The prompt's Role and Rules sections. The rules are `DEFAULT_RULES`, by key (`reply`, `facts`, `confirm`); `rules` as an object changes them by key (a new key adds a rule, a key of theirs replaces it, null removes it), and as a list replaces them all.
- The call's record in `global_data` (see [The Call's Record](#the-calls-record)). The conscience is `${global_data.ops.now}`: where the call stands, on every request.
- `confirm_change` with its one gate, `decline_change`, and `transfer_to_human` gated on the caller asking for a person. A gate that refuses has the model answer in words before it calls a tool again (`backToBackFunctions(false)`, which lasts for the call), and every generated tool's result turns chaining back on (`'forever'`), so one refusal doesn't keep the model from chaining tools for the rest of the call.

`agent.preview()` returns each step's text and tools, as the model gets them, as text to print or check. Overrides: `wording` (see [Words, Languages and the Medium](#words-languages-and-the-medium)), `confirmGates`, `toolFillers`, `gateFillers`, `wrap` (middleware around every generated handler), `customize(contexts)` (the generated `ContextBuilder`, to change it), and `namespace` and `context` (see [Two Services on One Agent](#two-services-on-one-agent)).

## The Call's Record

The record is one `global_data` key, `ops` by default. A service keeps one for its changes, its caller's account, or the medium found on a call's first request; one with only lookups and a `medium` of its own keeps none. Its `v` is `RECORD_VERSION` (`import { RECORD_VERSION } from '@signalwire/sdk/operations'`), which goes up when a key is renamed or changes meaning, never when one is added. These keys are for you to read, in prompts and SWML as `${global_data.ops.<key>}` and in your own code:

| Key          | What it holds                                                                                                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v`          | The record's version                                                                                                                                                                                           |
| `account_id` | The account identified, or `""`                                                                                                                                                                                |
| `account`    | The account in a few words, as `describe` gives it                                                                                                                                                             |
| `asked`      | What the caller asked for before they were identified                                                                                                                                                          |
| `medium`     | `voice` or `chat`, found on the call's first request, or `""`                                                                                                                                                  |
| `history`    | The changes settled: each one's `kind`, `touches`, `read_back`, `outcome` (`made`, `not made` with the backend's `reason`, `declined` or `replaced`), `done`, `money` (an exact decimal string) and `currency` |
| `now`        | Where the call stands, in words, worked out again on every update                                                                                                                                              |

`waiting`, `queued`, `proposals` and `state` are the service's own. Read your own state through `call.state`.

## Words, Languages and the Medium

Every string the service generates comes from a key in `DEFAULT_WORDING`: the steps' text, the tools' descriptions, tool results and prompts, the gates, the transfer notice and the record's `now` line. `wording` replaces any of them. A `{name}` in a template is a placeholder; an override may leave placeholders out but not add any, and an unknown key or placeholder fails when the service is made. A platform variable such as `${global_data.today}` is kept as written.

```ts
import { Operations } from '@signalwire/sdk/operations';

const ops = new Operations({
  role: 'Atiendes el teléfono de una tienda. Hablas siempre en español.',
  wording: { 'transfer.notice': 'Un momento, le paso con una persona.' },
});
```

The model answers in the language its role asks for. The other words are instructions to the model, so English ones work in any language; the transfer notice is the one the platform speaks word for word. Fillers given as a plain list are for every language; give lists by language code for more than one.

The service doesn't assume a phone call. `medium: 'voice'` or `medium: 'chat'` is for a service that only takes calls, or only chats: the `reply` rule starts with it ("This is a phone call."). Without one, each call's medium is found on its first request, from the platform's `conversation_type`, kept in the record as `medium`, and stated at the head of `now`. `call.medium` gives it to your operations. `ServiceAgent` finds it on every SWML request; an agent configured per request gets it from `await ops.prefilled(requestData)`, as global data.

## Games, Kiosks and Screens

`static confirm = false` on an operation makes it a change that goes through when it's called, with no read-back, such as a move in a game. `phase(name, text, tools)` declares a step of your own; a tool moves to it with `call.go(name)`. `call.state` is your own state for the call, kept in `global_data`, and `call.show(event)` sends an event to the caller's screen with the tool's result.

```ts
import assert from 'node:assert/strict';
import { CallSimulator } from '@signalwire/sdk';
import {
  type CallContext,
  Change,
  Field,
  Operation,
  ServiceAgent,
  type Values,
} from '@signalwire/sdk/operations';

const agent = new ServiceAgent({ name: 'dealer', role: 'You deal cards.' });

class Bet extends Operation {
  static override description = 'Place a bet and deal.';
  static override confirm = false;
  amount = new Field('integer', 'The bet, in chips.');

  override prepare(call: CallContext, f: Values): Change {
    call.state['bet'] = f['amount'];
    call.show({ type: 'deal', cards: [10, 7] });
    call.go('playing');
    return new Change({ readBack: '', done: `Bet ${String(f['amount'])}. You have 17.` });
  }
}
agent.operation(Bet, { tool: 'place_bet' });
agent.phase('betting', "Ask how much they'd like to bet, and call place_bet.", ['place_bet'], {
  initial: true,
});
agent.phase('playing', "They're playing their hand.", []);

const call = new CallSimulator(agent);
const out = await call.call('place_bet', { amount: 10, data_supplied_by_user: true });
assert.equal(out.response, 'Done. Bet 10. You have 17.');
assert.equal(call.step, 'playing');
```

## Installing on Your Own Agent

`ServiceAgent` is a prefab over `Operations`, which installs on any `AgentBase`, for an agent configured per request or one that already has its own setup. `ServiceAgent` takes every `Operations` option, such as `rules`, `wording`, `currency` and `namespace`, beside the agent's own.

```ts
import { AgentBase } from '@signalwire/sdk';
import { Operations } from '@signalwire/sdk/operations';

const ops = new Operations({ role: 'You answer the phone for an online store.' });
const agent = new AgentBase({ name: 'store', route: '/store' });
ops.install(agent);
```

`install` adds to what the agent has, and replaces none of it: a Role or Rules section it has already gets the service's text after its own (a rule it has isn't repeated), a step that exists keeps its text and tools, an initial step it chose stands, and the conscience gets the service's line appended. Other layers can install on the same agent, before or after. A tool name the agent has already fails the install, before anything is changed. Tools the service didn't make, such as a skill's or another layer's, go into its steps with `offer(tools)`: every generated step but `identify` and `confirm` by default, `identify` as well with `beforeIdentity: true`, or exactly the steps named with `steps: [...]`.

For an agent configured per request, apply `await ops.prefilled(requestData)` to the request's copy as global data, so the call starts with its medium and, with `identify`'s `prefill`, identified. `ServiceAgent` does this itself, with or without a per-request callback: a per-request copy has it before its callbacks run.

## Two Services on One Agent

`namespace` names everything a service generates, so it can sit beside another service, or beside tools and steps of the same names: with `namespace: 'billing'` the tools are `confirm_billing_change`, `decline_billing_change`, `billing_transfer_to_human` and `billing_find_account`, the steps `billing_identify`, `billing_main` and `billing_confirm`, the transfer's context `billing_transferred`, and the record `global_data.billing`. `call.go('main')` and `offer(tools, { steps: ['main'] })` still name the generated steps as generated. `context` puts the steps in a context other than `default`.

Each service's steps offer its own tools. To let a caller reach both from either, offer each one's tools in the other's steps:

```ts
import { AgentBase } from '@signalwire/sdk';
import { Operations } from '@signalwire/sdk/operations';

const billing = new Operations({ role: 'You handle billing.', namespace: 'billing' });
const orders = new Operations({ role: 'You handle orders.', namespace: 'orders' });
// ... each service's operations, registered with billing.operation and orders.operation ...
billing.offer(['confirm_orders_change', 'decline_orders_change'], { steps: ['main', 'confirm'] });
orders.offer(['confirm_billing_change', 'decline_billing_change'], { steps: ['main', 'confirm'] });
const agent = new AgentBase({ name: 'front', route: '/front' });
billing.install(agent);
orders.install(agent);
```

Each service keeps its own changes and record. The caller's yes is judged against the latest read-back, whichever service made it, so a yes heard for the other service's read-back reads this one's back again rather than carrying it out.

## InfoBot: Answering From a Corpus

`@signalwire/sdk/operations/infobot` is the half of an operations agent that answers rather than changes.

`new InfoBotKnowledge({ search })` adds a search tool, `search_knowledge`, that hands the model one grounded block of results. `search(query)` returns the raw results, each an object with a `content` string and a `score`, and may be async; `useSearchService(url)` uses a SignalWire search service instead. The policy is yours, in hooks: `setExclude`, `setDemote`, `setAuthority`, `setResultContext`, `setQueryTransform`, `setFallback`, `setExpander`, `addRule` and `addResultRule`, and `addQueryType` for a `query_type` argument. With `contact`, a second tool records the caller's details for a human follow-up: `contactFields` sets what it takes, and `contactAnyOf` which fields are enough, such as `[['email'], ['phone']]`. Its words are in `KNOWLEDGE_WORDING`, and `wording` replaces them. It installs in the `main` step (`step` and `context` choose another), before or after `Operations`, and the step keeps every layer's text and tools.

```ts
import { AgentBase } from '@signalwire/sdk';
import { InfoBotKnowledge } from '@signalwire/sdk/operations/infobot';

const docs = [{ content: 'We open at 9 and close at 5.', score: 0.9 }];
const agent = new AgentBase({ name: 'help', route: '/help' });
new InfoBotKnowledge({ search: () => docs }).install(agent);
```

`new Continuity().install(agent)` carries a conversation across a switch between voice and chat. Each leg's transcript and medium are kept in a `LegStore` at the leg's end, and the next leg starts seeded with them (`buildSeed`): a user turn recording the switch (`switchTurn`) and a note not to answer again what was handled (`switchNote`). It works through the agent's per-request callbacks, after the agent's own, so set that first. The default store is one JSON file per conversation on this host, for development; `store.setStore({ load, append })` puts it in your database (either may be async). `sayIntoCall(callId, text)` speaks on a live call from elsewhere, through the REST API.

## Testing

`CallSimulator` runs an operations agent offline: tool calls, the steps they move to, the gates (every gate passes unless you answer it) and the record in `call.globalData`. `requestFields` adds fields to every tool request, as the platform sends them for a call, such as `{ caller_id_num: '+15551234567' }`. The examples above are tests of that kind.
