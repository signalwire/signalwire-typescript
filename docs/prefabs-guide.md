# Prefab Agents Guide

The SDK includes five prefab agents, each an `AgentBase` subclass for a common call flow. This guide lists each prefab's options, its tools, and what the tools do.

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module (top-level await)
declare global {
  const InfoGathererAgent: typeof import('@signalwire/sdk').InfoGathererAgent;
  const SurveyAgent: typeof import('@signalwire/sdk').SurveyAgent;
  const FAQBotAgent: typeof import('@signalwire/sdk').FAQBotAgent;
  const ConciergeAgent: typeof import('@signalwire/sdk').ConciergeAgent;
  const ReceptionistAgent: typeof import('@signalwire/sdk').ReceptionistAgent;
}
```

---

## Table of Contents

- [Overview](#overview)
- [InfoGathererAgent](#infogathereragent)
  - [Configuration](#infogatherer-configuration)
  - [Questions](#infogatherer-questions)
  - [Tools](#infogatherer-tools)
  - [Dynamic Mode](#dynamic-mode)
  - [Example](#infogatherer-example)
- [SurveyAgent](#surveyagent)
  - [Configuration](#survey-configuration)
  - [Question Types](#survey-question-types)
  - [Branching Logic](#survey-branching-logic)
  - [Scoring](#survey-scoring)
  - [Tools](#survey-tools)
  - [Example](#survey-example)
- [FAQBotAgent](#faqbotagent)
  - [Configuration](#faqbot-configuration)
  - [Matching Engine](#faqbot-matching-engine)
  - [Tools](#faqbot-tools)
  - [Example](#faqbot-example)
- [ConciergeAgent](#conciergeagent)
  - [Configuration](#concierge-configuration)
  - [Tools](#concierge-tools)
  - [Example](#concierge-example)
- [ReceptionistAgent](#receptionistagent)
  - [Configuration](#receptionist-configuration)
  - [Tools](#receptionist-tools)
  - [Example](#receptionist-example)
- [Factory Functions](#factory-functions)
- [Subclassing Prefabs](#subclassing-prefabs)

---

## Overview

A prefab agent is an `AgentBase` subclass that configures itself from one options object. Each prefab:

- **Extends `AgentBase`**, so it has the same HTTP serving, SWML rendering, basic auth and proxy handling.
- **Builds its prompt in its constructor** with `promptAddSection()`, from your options: the question list, the FAQ entries, the departments and so on.
- **Sets AI parameters, hints and global data** suited to its call flow.
- **Registers its SWAIG tools** in a `defineTools()` override.

A tool's response is context for the model, not speech: the model reads it and decides what to say. Several tools return instructions for the model, such as the next question to ask.

The prefabs keep per-call state in one of two places. `InfoGathererAgent` keeps its question list and position in the call's `global_data`, and updates it with `set_global_data` actions in its tool responses. `SurveyAgent` and `ReceptionistAgent` keep theirs in memory in the agent process, keyed by the request's `call_id`. That state isn't shared between replicas and is lost on a restart. The agent removes a call's state when the call's summary arrives at `/post_prompt`, or once the call has been idle for an hour, and holds at most 10,000 calls, dropping the least recently used. If you override `onSummary()` on one of these agents, call `super.onSummary(summary, rawData)` so the state is removed when the call ends.

Every prefab takes `name`, `route` and `agentOptions`. `agentOptions` is passed to the `AgentBase` constructor after `name` and `route`, so a `route` or `name` in `agentOptions` wins over the top-level option. All five classes and their config types are exported from the package:

```typescript
import {
  InfoGathererAgent, SurveyAgent, FAQBotAgent,
  ConciergeAgent, ReceptionistAgent,
} from '@signalwire/sdk';
```

---

## InfoGathererAgent

An agent that asks the caller a list of questions, one at a time, and records each answer in the call's `global_data`. The questions are fixed at construction (static mode) or chosen for each call by a callback (dynamic mode).

**Source:** `src/prefabs/InfoGathererAgent.ts`

### InfoGatherer Configuration

The constructor accepts an `InfoGathererConfig` object:

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | No | `"info_gatherer"` | Agent name. |
| `route` | `string` | No | `"/info_gatherer"` | HTTP route for this agent. |
| `questions` | `InfoGathererQuestion[]` | No | none | Questions to ask (static mode). Omit it for dynamic mode. |
| `questionCallback` | `InfoGathererQuestionCallback` | No | none | Chooses the questions for each call (dynamic mode). The same as calling `setQuestionCallback()` after construction. Ignored when `questions` is set. |
| `agentOptions` | `Partial<AgentOptions>` | No | none | Other `AgentBase` options, such as `port` or `basicAuth`. |

The constructor throws if `questions` is an empty array, or a question lacks `key_name` or `question_text`. It sets the AI parameters `end_of_speech_timeout` to 800 and `speech_event_timeout` to 1000.

### InfoGatherer Questions

Each entry in the `questions` array is an `InfoGathererQuestion`:

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `key_name` | `string` | Yes | none | Key the answer is stored under. |
| `question_text` | `string` | Yes | none | The question to ask the caller. |
| `confirm` | `boolean` | No | `false` | When `true`, the tool tells the model to have the caller confirm the answer before submitting it. |

In static mode, the agent's `global_data` holds `questions`, `question_index` (starting at 0) and `answers` (an empty list).

### InfoGatherer Tools

The agent registers two SWAIG tools.

#### `start_questions`

Reads the first question from the request's `global_data.questions` and returns an instruction for the model to ask it.

**Parameters:** None.

**Returns:** The instruction, including whether the caller must confirm the answer. It also sets `replace_in_history` to `Welcome! Let me ask you a few questions.`. If there are no questions left, it returns `I don't have any questions to ask.`.

#### `submit_answer`

Records the answer to the current question and moves to the next.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `answer` | `string` | Not marked required | The caller's answer to the current question. |

**Behavior:**
- Adds `{ key_name, answer }` to `answers` and increases `question_index`, with a `set_global_data` action.
- If more questions remain, returns the instruction to ask the next one.
- After the last question, returns a message telling the model that all questions are answered.
- If every question was already answered, returns `All questions have already been answered.`.

### Dynamic Mode

Omit `questions` and register a callback that returns the question list for each call. The callback runs on every SWML request, before the SWML is rendered, and its list becomes that call's `global_data.questions`.

The callback's signature is `(queryParams, bodyParams, headers)`. `queryParams` holds the query parameters of the SWML request's URL, `bodyParams` the SWML request body, and `headers` the request's HTTP headers, with lower-case names. The SDK removes `Authorization`, `Cookie` and the other credential headers before the callback sees them. This callback chooses the questions from a query parameter, so a webhook URL ending in `?mode=support` gets the support questions:

```typescript
const agent = new InfoGathererAgent({ name: 'dynamic-intake' });
agent.setQuestionCallback((queryParams, bodyParams, headers) => {
  if (queryParams['mode'] === 'support') {
    return [
      { key_name: 'name', question_text: 'What is your name?' },
      { key_name: 'issue', question_text: "What's the issue?" },
    ];
  }
  return [{ key_name: 'name', question_text: 'What is your name?' }];
});
```

Without a callback, or when the callback throws or returns an invalid list, the agent uses two fallback questions. They are `name` ("What is your name?") and `message` ("How can I help you today?").

### InfoGatherer Example

This agent collects four answers for a patient intake line:

<!-- snippet: no-run starts a blocking HTTP server (serve/start/run on a fixed port); collides under the concurrent gate and cannot run standalone -->
```typescript
import { InfoGathererAgent } from '@signalwire/sdk';

const agent = new InfoGathererAgent({
  name: 'PatientIntake',
  questions: [
    { key_name: 'full_name', question_text: 'What is your full legal name?' },
    { key_name: 'date_of_birth', question_text: 'What is your date of birth?', confirm: true },
    { key_name: 'phone_number', question_text: 'What is a good callback number?', confirm: true },
    { key_name: 'insurance_provider', question_text: 'Who is your insurance provider?' },
  ],
  agentOptions: {
    port: 3001,
    route: '/intake',
  },
});

await agent.run();
```

---

## SurveyAgent

An agent that runs a survey with typed questions, branching based on answers, and scoring.

**Source:** `src/prefabs/SurveyAgent.ts`

### Survey Configuration

The constructor accepts a `SurveyConfig` object:

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | No | `"survey"` | Agent name. |
| `route` | `string` | No | `"/survey"` | HTTP route for this agent. |
| `surveyName` | `string` | Yes | none | Survey name, used in the prompt, hints and global data. |
| `questions` | `SurveyQuestion[]` | Yes | none | Ordered list of survey questions. |
| `introduction` | `string` | No | `"Welcome to our ${surveyName}. We appreciate your participation."` | Opening message. It's the call's static greeting, which the caller can't interrupt, and the prompt tells the model to begin with it. |
| `conclusion` | `string` | No | `"Thank you for completing our survey. Your feedback is valuable to us."` | Closing message, in the prompt and in `answer_question`'s final response. |
| `brandName` | `string` | No | `"Our Company"` | Company name the prompt says the agent represents. |
| `maxRetries` | `number` | No | `2` | Number of retries for an invalid answer. It goes into the prompt and `global_data`; the SDK doesn't count retries. |
| `onComplete` | `(responses: Record<string, unknown>, score: number) => void \| Promise<void>` | No | none | Called when `answer_question` finishes the survey, with the answers and the total score. An error it throws is logged. |
| `agentOptions` | `Partial<AgentOptions>` | No | none | Other `AgentBase` options. |

Each `SurveyQuestion` has this shape:

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Unique question ID. An empty ID becomes `question_N`, from the question's position. |
| `text` | `string` | Yes | The question to ask the caller. |
| `type` | `'multiple_choice' \| 'open_ended' \| 'rating' \| 'yes_no'` | Yes | Question type; sets how an answer is validated. |
| `options` | `string[]` | For `multiple_choice` | Answer options. A `multiple_choice` question without options throws. |
| `scale` | `number` | No | For `rating` questions, the top of the 1 to `scale` range. Defaults to `5`. |
| `required` | `boolean` | No | Whether an answer is required. Defaults to `true`. |
| `nextQuestion` | `string \| Record<string, string>` | No | The question after this one (see [Branching Logic](#survey-branching-logic)). |
| `points` | `number \| Record<string, number>` | No | Points for an answer (see [Scoring](#survey-scoring)). |

The constructor throws on a question without `text` or with an unknown `type`. It adds the survey name, the brand name, rating numbers, options and `yes`/`no` as speech hints, and enables the `check_time` native function.

### Survey Question Types

Each type accepts these answers:

| Type | Valid answer | Notes |
|---|---|---|
| `multiple_choice` | One of the `options`, ignoring case and surrounding spaces. | The prompt tells the model to list the options. |
| `open_ended` | Any answer. An empty answer is invalid when the question is required. | Stored as given. |
| `rating` | A whole number from 1 to `scale`. | The prompt tells the model to explain the scale. |
| `yes_no` | `yes`, `y`, `no` or `n`, ignoring case. | Stored as `"yes"` or `"no"`. |

### Survey Branching Logic

`answer_question` uses the answered question's `nextQuestion` to pick the next question:

| Value | Behavior |
|---|---|
| omitted | The next question in array order. After the last question, the survey ends. |
| `string` | The question with this ID, whatever the answer. |
| `Record<string, string>` | The ID mapped to the answer, matching the stored answer (so `"yes"` or `"no"` for a `yes_no` question) and ignoring case. A `_default` key applies when no key matches. Without one, the next question in array order. |

If the chosen ID isn't a question in the survey, the survey ends.

### Survey Scoring

The `points` property sets the points an answer earns:

| Value | Behavior |
|---|---|
| omitted | No points. |
| `number` | These points for any valid answer. |
| `Record<string, number>` | The points mapped to the stored answer, ignoring case. An answer with no entry earns 0. |

`answer_question` adds the points to the call's total, which it passes to `onComplete`.

### Survey Tools

The agent registers these SWAIG tools:

#### `validate_response`

Checks a response against a question's type without recording it.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `question_id` | `string` | Not marked required | The ID of the question to validate against. |
| `response` | `string` | Not marked required | The response to check. |

**Returns:** `Response to '<id>' is valid.`, the reason it's invalid, or an error for an unknown question ID.

#### `log_response`

Stores a response for a question in the call's in-memory state.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `question_id` | `string` | Not marked required | The ID of the question. |
| `response` | `string` | Not marked required | The response to store. |

**Returns:** A message naming the question's text. It doesn't validate the response, add points, move to another question or call `onComplete`.

#### `answer_question`

Validates, stores and scores an answer, then moves to the next question.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `question_id` | `string` | Yes | The ID of the question being answered. |
| `answer` | `string` | Yes | The caller's answer. |

**Behavior:**
- Returns the validation error if the answer isn't valid for the question's type.
- Stores the answer, normalizing `yes_no` answers to `"yes"` or `"no"`.
- Adds the answer's points to the total.
- Picks the next question with the branching logic.
- If there is no next question, marks the survey complete, calls `onComplete`, and returns the number of answers, the total score and the conclusion.
- Otherwise, returns the next question's ID and text, with its options, rating range or yes/no hint.
- After the survey is complete, returns `The survey has already been completed.`.

#### `get_current_question`

Returns the question the call is on.

**Parameters:** None.

**Returns:** The question's ID, type and text, with its options, rating range or yes/no hint.

#### `get_survey_progress`

Returns the call's progress through the survey.

**Parameters:** None.

**Returns:** The number of questions answered out of the total, the percentage, the current score, whether the survey is complete, and the answers so far.

### Survey Example

This survey branches on the recommendation question and scores two answers:

<!-- snippet: no-run starts a blocking HTTP server (serve/start/run on a fixed port); collides under the concurrent gate and cannot run standalone -->
```typescript
import { SurveyAgent } from '@signalwire/sdk';

const agent = new SurveyAgent({
  name: 'CustomerSatisfaction',
  surveyName: 'Customer Satisfaction Survey',
  introduction: 'Hi, we would like your feedback about our service.',
  conclusion: 'Thank you for your feedback.',
  questions: [
    {
      id: 'overall',
      text: 'On a scale of 1 to 10, how would you rate your overall experience?',
      type: 'rating',
      scale: 10,
      points: { '9': 10, '10': 10, '7': 7, '8': 7 },
    },
    {
      id: 'recommend',
      text: 'Would you recommend us to a friend?',
      type: 'yes_no',
      points: { 'yes': 5, 'no': 0 },
      nextQuestion: {
        'yes': 'what_liked',
        'no': 'what_improve',
      },
    },
    {
      id: 'what_liked',
      text: 'What did you like the most about our service?',
      type: 'open_ended',
      nextQuestion: 'followup',
    },
    {
      id: 'what_improve',
      text: 'What could we improve?',
      type: 'open_ended',
      nextQuestion: 'followup',
    },
    {
      id: 'followup',
      text: 'How would you like us to follow up?',
      type: 'multiple_choice',
      options: ['Email', 'Phone call', 'No follow-up needed'],
    },
  ],
  onComplete: async (responses, score) => {
    console.log('Survey complete. Score:', score);
    console.log('Responses:', responses);
    // Store results, send to analytics, etc.
  },
});

await agent.run();
```

---

## FAQBotAgent

An agent that answers questions from a list of frequently asked questions. The prompt contains every question and answer, and a search tool tells the model which entries match the caller's question. It can transfer the caller to a live agent.

**Source:** `src/prefabs/FAQBotAgent.ts`

### FAQBot Configuration

The constructor accepts a `FAQBotConfig` object:

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | No | `"faq_bot"` | Agent name. |
| `route` | `string` | No | `"/faq"` | HTTP route for this agent. |
| `faqs` | `FAQEntry[]` | Yes | none | The FAQ entries. Each one with a question and an answer goes into the prompt. |
| `suggestRelated` | `boolean` | No | `true` | Add prompt instructions to suggest related questions. |
| `persona` | `string` | No | `"You are a helpful FAQ bot that provides accurate answers to common questions."` | Text of the prompt's Personality section. |
| `threshold` | `number` | No | `0.5` | Minimum match score, from 0 to 1, for `search_faqs` to return an entry. |
| `escalationMessage` | `string` | No | `"I'm sorry, I couldn't find an answer to your question. Let me transfer you to someone who can help."` | Start of the `escalate` tool's response. |
| `escalationNumber` | `string` | No | none | Phone number or SIP address `escalate` transfers to. Without it, the agent doesn't register `escalate`. |
| `agentOptions` | `Partial<AgentOptions>` | No | none | Other `AgentBase` options. |

Each `FAQEntry` has this shape:

| Property | Type | Required | Description |
|---|---|---|---|
| `question` | `string` | Yes | The question. |
| `answer` | `string` | Yes | The answer. |
| `keywords` | `string[]` | No | Words that raise the entry's match score when the query contains them. |
| `categories` | `string[]` | No | Categories, shown in the prompt and usable as a `search_faqs` filter. |

The agent adds the questions' words of four or more characters, the keywords and the categories as speech hints. Its `global_data` holds `faq_count` and `categories`.

### FAQBot Matching Engine

`search_faqs` scores each entry by the words it shares with the query.

**Tokenization:**
1. Text is lowercased.
2. Characters other than `a` to `z`, digits and white space become spaces.
3. Text is split on white space.
4. Words shorter than 2 characters are removed.
5. Common English stop words are removed ("the", "is", "to", "and", "or" and others).

**Scoring:**
- **Question overlap**: the number of query words found in the entry's question, divided by the smaller of the two word counts.
- **Keyword score**: the number of keywords found anywhere in the lowercased query, divided by the number of keywords.
- **Combined score**: with keywords, `0.6 * questionOverlap + 0.4 * keywordScore`. Without keywords, the question overlap alone.

Entries that score at least `threshold` match, best first.

### FAQBot Tools

#### `search_faqs`

Searches the FAQ entries for the caller's question.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | Not marked required | The search query. Without it, the tool returns `A query is required to search the FAQ.`. |
| `category` | `string` | No | Search only entries with this category, ignoring case. |

**Returns:** `Here are the most relevant FAQs:` and a numbered list of up to three matching questions, without their answers. The model finds the answers in its prompt. With no match, it returns `No matching FAQs found.`.

#### `escalate`

Transfers the caller. The agent registers it only when `escalationNumber` is set.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `reason` | `string` | No | The reason for the transfer. Defaults to `"Caller needs assistance beyond FAQ"`. |

**Behavior:** Returns `escalationMessage` followed by the reason, with a `FunctionResult.connect()` action that transfers the call to `escalationNumber` permanently.

### FAQBot Example

This agent answers four questions and can transfer to a support line:

<!-- snippet: no-run starts a blocking HTTP server (serve/start/run on a fixed port); collides under the concurrent gate and cannot run standalone -->
```typescript
import { FAQBotAgent } from '@signalwire/sdk';

const agent = new FAQBotAgent({
  name: 'HelpDesk',
  threshold: 0.4,
  escalationNumber: '+15559876543',
  escalationMessage: 'I was not able to find an answer for that. Let me connect you with a support specialist.',
  faqs: [
    {
      question: 'What are your business hours?',
      answer: 'We are open Monday through Friday, 9 AM to 5 PM Eastern Time.',
      keywords: ['hours', 'open', 'close', 'schedule', 'when'],
    },
    {
      question: 'How do I reset my password?',
      answer: 'Go to the login page, click "Forgot Password", and follow the email instructions.',
      keywords: ['password', 'reset', 'forgot', 'login', 'locked'],
    },
    {
      question: 'What is your return policy?',
      answer: 'We offer a 30-day return policy for unused items in original packaging.',
      keywords: ['return', 'refund', 'exchange', 'policy'],
    },
    {
      question: 'How do I contact support?',
      answer: 'You can reach our support team by calling this number, by email at support@example.com, or through live chat on our website.',
      keywords: ['support', 'contact', 'help', 'email', 'chat'],
    },
  ],
  agentOptions: {
    route: '/helpdesk',
  },
});

await agent.run();
```

---

## ConciergeAgent

A concierge for a venue or business. Its prompt describes the venue's services, amenities and hours, and its tools answer availability and directions questions.

**Source:** `src/prefabs/ConciergeAgent.ts`

### Concierge Configuration

The constructor accepts a `ConciergeConfig` object:

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | No | `"concierge"` | Agent name. |
| `route` | `string` | No | `"/concierge"` | HTTP route for this agent. |
| `venueName` | `string` | Yes | none | Name of the venue or business. |
| `services` | `string[]` | Yes | none | Services offered. |
| `amenities` | `Record<string, Record<string, string>>` | Yes | none | Amenities, each a map of details such as `hours` and `location`. |
| `hoursOfOperation` | `Record<string, string>` | No | `{ default: '9 AM - 5 PM' }` | Opening hours by category. |
| `specialInstructions` | `string[]` | No | `[]` | Extra bullets for the prompt's Instructions section. |
| `welcomeMessage` | `string` | No | none | When set, the call's static greeting, which the caller can't interrupt. |
| `agentOptions` | `Partial<AgentOptions>` | No | none | Other `AgentBase` options. |

The venue name, the services and the amenity names become speech hints. The agent sets `local_tz` to `America/New_York` and enables the `check_time` native function.

### Concierge Tools

#### `check_availability`

Answers whether a service is available at a date and time.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `service` | `string` | Not marked required | The service to check. |
| `date` | `string` | Not marked required | The date, in `YYYY-MM-DD` format. |
| `time` | `string` | Not marked required | The time, in 24-hour `HH:MM` format. |

**Returns:** For a service in `services` (ignoring case), a response that it's available at that date and time. The tool doesn't check a calendar or a booking system, so a listed service is always reported available. For any other service, a response listing the services offered. Override `checkAvailability()` in a subclass to look up real availability.

#### `get_directions`

Returns directions to an amenity.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `location` | `string` | Not marked required | The amenity to get directions to. |

**Returns:** Directions built from the amenity's `location` detail. The lowercased `location` argument must equal the amenity's key exactly, so use lowercase keys in `amenities`. Otherwise, a response that suggests asking at the front desk.

### Concierge Example

This agent describes a hotel's services and two amenities:

<!-- snippet: no-run starts a blocking HTTP server (serve/start/run on a fixed port); collides under the concurrent gate and cannot run standalone -->
```typescript
import { ConciergeAgent } from '@signalwire/sdk';

const agent = new ConciergeAgent({
  venueName: 'Grand Hotel',
  services: ['room service', 'spa bookings', 'restaurant reservations'],
  amenities: {
    pool: { hours: '7 AM - 10 PM', location: '2nd Floor' },
    gym: { hours: '24 hours', location: '3rd Floor' },
  },
  hoursOfOperation: { weekday: '9 AM - 9 PM', weekend: '10 AM - 6 PM' },
  specialInstructions: ['Always mention the weekly wine tasting.'],
  welcomeMessage: 'Welcome to the Grand Hotel. How may I assist you?',
});

await agent.run();
```

---

## ReceptionistAgent

A front-desk agent that greets callers, collects their name and reason for calling, and transfers them to a department. It can also check in visitors, a tool the Python SDK's prefab doesn't have.

**Source:** `src/prefabs/ReceptionistAgent.ts`

### Receptionist Configuration

The constructor accepts a `ReceptionistConfig` object:

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | No | `"receptionist"` | Agent name. |
| `route` | `string` | No | `"/receptionist"` | HTTP route for this agent. |
| `departments` | `ReceptionistDepartment[]` | Yes | none | Departments the agent can transfer callers to. The constructor throws if the list is empty or an entry lacks a field. |
| `greeting` | `string` | No | `"Thank you for calling. How can I help you today?"` | Greeting the prompt tells the model to begin with. |
| `voice` | `string` | No | `"rime.spore"` | Voice of the English (`en-US`) language the agent adds. |
| `companyName` | `string` | No | none | Company name, added to the greeting as `Welcome to <companyName>.` and as a speech hint. |
| `checkInEnabled` | `boolean` | No | `false` | Register the `check_in_visitor` tool. |
| `onVisitorCheckIn` | `(visitor: Record<string, string>) => void \| Promise<void>` | No | none | Called when `check_in_visitor` records a visitor. An error it throws is logged. |
| `agentOptions` | `Partial<AgentOptions>` | No | none | Other `AgentBase` options. |

Each `ReceptionistDepartment` has this shape:

| Property | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes | Department name, one of the `transfer_call` tool's allowed values. |
| `description` | `string` | Yes | What the department handles, listed in the prompt. |
| `number` | `string` | Yes | Phone number or SIP address to transfer to. |

The agent sets `end_of_speech_timeout` to 700, `speech_event_timeout` to 1000 and `transfer_summary` to `true`. Its `global_data` starts with `departments` and an empty `caller_info`.

### Receptionist Tools

#### `collect_caller_info`

Records the caller's name and reason for calling in `global_data.caller_info`, with a `set_global_data` action.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Not marked required | The caller's name. |
| `reason` | `string` | Not marked required | The reason for the call. |

**Returns:** A response that repeats the name and reason.

#### `transfer_call`

Transfers the caller to a department.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `department` | `string` (one of the department names) | Not marked required | The department to transfer to. |

**Behavior:**
- Reads `global_data.caller_info.name`, set by `collect_caller_info`, for the response.
- Sets `post_process`, which gives the model one more turn to respond before the transfer action runs.
- Adds a `connect(number, true)` action, a permanent transfer to the department's number.
- For an unknown department name, returns a response that it couldn't find the department, and doesn't transfer.

#### `check_in_visitor`

Registered only when `checkInEnabled` is `true`. Records a visitor in the call's in-memory state and calls `onVisitorCheckIn` with the record.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `visitor_name` | `string` | Yes | Full name of the visitor. |
| `purpose` | `string` | Yes | Purpose of the visit. |
| `visiting` | `string` | Yes | The person or department the visitor is here to see. |

The record passed to `onVisitorCheckIn` has `visitor_name`, `purpose`, `visiting` and `checked_in_at`, an ISO 8601 time.

### Receptionist Example

This agent transfers callers to four departments and checks in visitors:

<!-- snippet: no-run starts a blocking HTTP server (serve/start/run on a fixed port); collides under the concurrent gate and cannot run standalone -->
```typescript
import { ReceptionistAgent } from '@signalwire/sdk';

const agent = new ReceptionistAgent({
  companyName: 'Acme Corporation',
  greeting: 'Thank you for calling Acme Corporation. How can I help you today?',
  voice: 'rime.spore',
  checkInEnabled: true,
  departments: [
    {
      name: 'engineering',
      description: 'Software development and technical teams',
      number: '+15551001001',
    },
    {
      name: 'hr',
      description: 'Employee services, benefits, and recruiting',
      number: '+15551001002',
    },
    {
      name: 'marketing',
      description: 'Brand, communications, and events',
      number: '+15551001003',
    },
    {
      name: 'executive',
      description: 'CEO and executive leadership',
      number: '+15551001004',
    },
  ],
  onVisitorCheckIn: async (visitor) => {
    console.log('Visitor checked in:', visitor);
    // Send a notification, update a visitor log, and so on
  },
  agentOptions: {
    route: '/reception',
  },
});

await agent.run();
```

---

## Factory Functions

Each prefab's source file also defines a factory function: `createInfoGathererAgent()`, `createSurveyAgent()`, `createFAQBotAgent()`, `createConciergeAgent()` and `createReceptionistAgent()`. Each takes the same config as its class and returns `new PrefabAgent(config)`.

The package's entry point (`@signalwire/sdk`) doesn't export these functions, and its `exports` map doesn't expose `src/prefabs/`, so code that installs the package can't import them. Use the class constructors, as the examples on this page do.

---

## Subclassing Prefabs

You can subclass a prefab to add prompt content or tools.

### Adding `PROMPT_SECTIONS`

The prefabs don't declare `static PROMPT_SECTIONS`; they build their prompts in their constructors. A subclass can declare `PROMPT_SECTIONS`, which the `AgentBase` constructor adds before the prefab adds its own sections. The prefab's sections stay, so use this to add content, not to replace the prefab's instructions:

```typescript
import { InfoGathererAgent } from '@signalwire/sdk';
import type { InfoGathererConfig } from '@signalwire/sdk';

class BilingualInfoGatherer extends InfoGathererAgent {
  static override PROMPT_SECTIONS = [
    {
      title: 'Language',
      body: 'You speak Spanish and English. Always respond in the same language the caller uses.',
    },
    {
      title: 'Rules',
      bullets: [
        'Ask one question at a time, in the order provided by start_questions.',
        'Use submit_answer to record each response and advance to the next question.',
        'If the caller needs to try again, ask in their language.',
      ],
    },
  ];

  constructor(config: InfoGathererConfig) {
    super(config);
  }
}
```

### Overriding `defineTools()`

Override `defineTools()` to add tools, and call `super.defineTools()` first to keep the prefab's own:

```typescript
import { FAQBotAgent, FunctionResult } from '@signalwire/sdk';

class FAQBotWithFeedback extends FAQBotAgent {
  protected override defineTools(): void {
    // Register all the default tools first
    super.defineTools();

    // Add a custom feedback tool
    this.defineTool({
      name: 'submit_feedback',
      description: 'Allow the caller to submit feedback about the FAQ answers.',
      parameters: {
        type: 'object',
        properties: {
          rating: {
            type: 'string',
            description: 'How helpful was the answer: good, okay, or poor.',
          },
          comment: {
            type: 'string',
            description: 'Optional comment from the caller.',
          },
        },
        required: ['rating'],
      },
      handler: (args: Record<string, unknown>) => {
        const rating = args['rating'] as string;
        const comment = args['comment'] as string | undefined;
        console.log(`FAQ Feedback: ${rating}${comment ? ' - ' + comment : ''}`);
        return new FunctionResult('The feedback was recorded.');
      },
    });
  }
}
```

The prefab constructors call `ensureToolsDefined()` themselves, so the override runs during construction, before the subclass's own field initializers. Don't read subclass fields in it.

### Adding Dynamic Prompt Sections

Call `this.promptAddSection()` in the subclass constructor to add sections after the prefab's own:

```typescript
import { ConciergeAgent } from '@signalwire/sdk';
import type { ConciergeConfig } from '@signalwire/sdk';

class HolidayConcierge extends ConciergeAgent {
  constructor(config: ConciergeConfig) {
    super(config);

    // Add a holiday schedule section to the prompt
    this.promptAddSection('Holiday Schedule', {
      body: 'The office is closed on December 25th and January 1st. All departments reopen on January 2nd.',
    });
  }
}
```
