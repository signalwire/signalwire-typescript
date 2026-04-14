# Prefab Agents Guide

Complete guide to the pre-built Prefab agents included in the SignalWire AI Agents TypeScript SDK.

---

## Table of Contents

- [Overview](#overview)
- [InfoGathererAgent](#infogathereragent)
  - [Configuration](#infogatherer-configuration)
  - [Fields](#infogatherer-fields)
  - [Tools](#infogatherer-tools)
  - [Session Tracking](#infogatherer-session-tracking)
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

Prefab agents are ready-to-use agent implementations built on top of `AgentBase`. They provide complete, production-ready AI voice agents for common use cases -- information gathering, surveys, FAQ bots, department routing, and front-desk reception.

Each prefab:

- **Extends `AgentBase`** and inherits all core functionality (HTTP serving, SWML generation, basic auth, CORS, proxy detection).
- **Defines its own SWAIG tools** through the `defineTools()` override, giving the AI model the ability to perform domain-specific actions.
- **Declares static `PROMPT_SECTIONS`** that set up the AI's role and behavioral rules automatically.
- **Adds dynamic prompt sections** in the constructor based on your configuration (field lists, question lists, department directories, etc.).
- **Tracks per-call session state** using `call_id` from the incoming request data, so multiple concurrent calls are isolated.

Prefabs can be used in two ways:

1. **Directly via the constructor** -- pass a configuration object and get a fully functional agent.
2. **Via a factory function** -- a shorthand that creates and returns a new instance (e.g., `createInfoGathererAgent(config)`).

All prefabs are exported from the main SDK entry point:

```typescript
import {
  InfoGathererAgent, SurveyAgent, FAQBotAgent,
  ConciergeAgent, ReceptionistAgent,
} from '@signalwire/sdk';
```

---

## InfoGathererAgent

A conversational agent that asks the caller a sequence of questions one at a time and records each answer in `global_data`. Supports both static configuration (questions defined at construction) and dynamic configuration (questions resolved per request via a callback).

**Source:** `src/prefabs/InfoGathererAgent.ts`

### InfoGatherer Configuration

The constructor accepts an `InfoGathererConfig` object:

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | No | `"info_gatherer"` | Agent display name. |
| `route` | `string` | No | `"/info_gatherer"` | HTTP route for this agent. |
| `questions` | `InfoGathererQuestion[]` | No | -- | Questions to ask (static mode). Omit for dynamic mode. |
| `questionCallback` | `InfoGathererQuestionCallback` | No | -- | Resolves questions per request (dynamic mode); equivalent to calling `setQuestionCallback()` after construction. |
| `agentOptions` | `Partial<AgentOptions>` | No | -- | Additional AgentBase options forwarded to `super()` (e.g., `port`, `basicAuth`). |

### InfoGatherer Questions

Each entry in the `questions` array is an `InfoGathererQuestion`:

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `key_name` | `string` | **Yes** | -- | Identifier used as the key when storing the caller's answer. |
| `question_text` | `string` | **Yes** | -- | The question text spoken to the caller. |
| `confirm` | `boolean` | No | `false` | When `true`, the agent insists the caller confirms the answer before submitting. |

### InfoGatherer Tools

The agent registers two SWAIG tools:

#### `start_questions`

Retrieves the first question from `global_data.questions` and returns an instruction asking the caller to answer it.

**Parameters:** None.

**Returns:** A formatted instruction including the first question's text and confirmation guidance when `confirm` is set. Also sets `replace_in_history` to the generic "Welcome" prompt.

#### `submit_answer`

Records the caller's answer to the current question and advances to the next.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `answer` | `string` | Yes | The caller's answer to the current question. |

**Behavior:**
- Appends `{ key_name, answer }` to `global_data.answers`.
- Increments `global_data.question_index`.
- If more questions remain, returns the next question's instruction text.
- If all questions are answered, returns the completion message.

### Dynamic Mode

Omit `questions` and register a callback to resolve the question list per incoming request:

```typescript
const agent = new InfoGathererAgent({ name: 'dynamic-intake' });
agent.setQuestionCallback((queryParams, bodyParams, headers) => {
  if (queryParams['set'] === 'support') {
    return [
      { key_name: 'name', question_text: 'What is your name?' },
      { key_name: 'issue', question_text: "What's the issue?" },
    ];
  }
  return [{ key_name: 'name', question_text: 'What is your name?' }];
});
```

The callback runs on every SWML request, and its return value populates `global_data.questions` for that call. If no callback is registered or the callback throws, a default two-question fallback (`name`, `message`) is used.

### InfoGatherer Example

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

agent.run();
```

---

## SurveyAgent

A conversational agent that conducts surveys with multiple question types, branching logic based on answers, and per-answer scoring.

**Source:** `src/prefabs/SurveyAgent.ts`

### Survey Configuration

The constructor accepts a `SurveyConfig` object:

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | No | `"survey"` | Agent display name. |
| `route` | `string` | No | `"/survey"` | HTTP route for this agent. |
| `surveyName` | `string` | **Yes** | -- | Human-readable survey name used in prompts and global data. |
| `questions` | `SurveyQuestion[]` | **Yes** | -- | Ordered list of survey questions. |
| `introduction` | `string` | No | `"Welcome to our ${surveyName}. We appreciate your participation."` | Opening message before the first question (used as a non-bargeable static greeting). |
| `conclusion` | `string` | No | `"Thank you for completing our survey. Your feedback is valuable to us."` | Message spoken after the survey is complete. |
| `brandName` | `string` | No | `"Our Company"` | Brand or company name the agent represents. |
| `maxRetries` | `number` | No | `2` | Maximum number of times to retry invalid answers. |
| `onComplete` | `(responses: Record<string, unknown>, score: number) => void \| Promise<void>` | No | -- | Callback fired when the survey is finished. Receives all responses and the total score. |
| `agentOptions` | `Partial<AgentOptions>` | No | -- | Additional AgentBase options. |

Each `SurveyQuestion` has the following shape:

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | **Yes** | Unique question identifier. |
| `text` | `string` | **Yes** | The question text to ask the caller. |
| `type` | `'multiple_choice' \| 'open_ended' \| 'rating' \| 'yes_no'` | **Yes** | Question type; determines validation and display. |
| `options` | `string[]` | No | Answer options (used when `type` is `multiple_choice`). |
| `scale` | `number` | No | For `rating` questions, the upper bound of the 1..scale range. Defaults to `5`. |
| `required` | `boolean` | No | Whether the question requires an answer. Defaults to `true`. |
| `nextQuestion` | `string \| Record<string, string>` | No | Controls flow after this question (see Branching Logic). |
| `points` | `number \| Record<string, number>` | No | Points awarded for answers (see Scoring). |

### Survey Question Types

| Type | Validation | Notes |
|---|---|---|
| `multiple_choice` | Answer must exactly match one of the `options` (case-insensitive). | All options are read aloud. |
| `open_ended` | No validation; any answer is accepted. | Free-form response. |
| `rating` | Must be an integer between 1 and the question's `scale` (default `5`). | The AI specifies the scale to the caller. |
| `yes_no` | Must be a recognized affirmative or negative word. | Accepts: `yes`, `y`, `yeah`, `yep`, `sure`, `absolutely`, `correct`, `true`, `no`, `n`, `nah`, `nope`, `negative`, `false`. Normalized to `"yes"` or `"no"` before storage. |

### Survey Branching Logic

The `nextQuestion` property controls which question follows the current one:

| Value | Behavior |
|---|---|
| `undefined` (omitted) | Proceed to the next question in array order. If this is the last question, the survey ends. |
| `string` | Always jump to the question with this ID, regardless of the answer. |
| `Record<string, string>` | Conditional branching: the answer value (case-insensitive) is looked up as a key, and the value is the next question ID. A special `_default` key serves as a fallback. If no key matches and there is no `_default`, falls through to the next question in array order. |

### Survey Scoring

The `points` property controls point accumulation:

| Value | Behavior |
|---|---|
| `undefined` (omitted) | No points for this question. |
| `number` | Fixed points awarded for any answer. |
| `Record<string, number>` | Per-answer scoring: the answer value (case-insensitive) is looked up as a key, and the matched value is the number of points awarded. Unmatched answers receive 0 points. |

The total score is accumulated across all answered questions and passed to the `onComplete` callback.

### Survey Tools

The agent registers the following SWAIG tools:

#### `validate_response`

Validates whether a response satisfies the question's type and constraints without recording or advancing.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `question_id` | `string` | Yes | The ID of the question to validate against. |
| `response` | `string` | Yes | The candidate response. |

**Returns:** A confirmation message when valid, or a type-specific error describing why the response is invalid.

#### `log_response`

Acknowledges that a validated response has been recorded for the specified question.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `question_id` | `string` | Yes | The ID of the question. |
| `response` | `string` | Yes | The validated response. |

**Returns:** A confirmation message referencing the question's text.

#### `answer_question`

Records the caller's answer to the current survey question.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `question_id` | `string` | Yes | The ID of the question being answered. |
| `answer` | `string` | Yes | The caller's answer. |

**Behavior:**
- Validates the answer based on question type. Returns a validation error if invalid.
- Normalizes the answer (e.g., yes/no variants become `"yes"` or `"no"`).
- Calculates and accumulates points.
- Resolves the next question via branching logic.
- If there is no next question, marks the survey complete, fires `onComplete`, and returns the completion message with answer count and total score.
- Otherwise, advances the session and returns the next question text with its type-specific instructions.

#### `get_current_question`

Returns the current question to be asked to the caller.

**Parameters:** None.

**Returns:** The question ID, type, text, and type-specific instructions (options for multiple choice, scale for rating, etc.).

#### `get_survey_progress`

Returns the current progress of the survey.

**Parameters:** None.

**Returns:** A summary including questions answered out of total, percentage complete, current score, completion status, and all answers so far.

### Survey Example

```typescript
import { SurveyAgent } from '@signalwire/sdk';

const agent = new SurveyAgent({
  name: 'CustomerSatisfaction',
  surveyName: 'Customer Satisfaction Survey',
  introduction: 'Hi! We would love to hear your feedback about our service.',
  conclusion: 'Thanks for your feedback! We really appreciate it.',
  questions: [
    {
      id: 'overall',
      text: 'How would you rate your overall experience?',
      type: 'rating',
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
    console.log('Survey complete! Score:', score);
    console.log('Responses:', responses);
    // Store results, send to analytics, etc.
  },
});

agent.start();
```

---

## FAQBotAgent

A conversational agent that answers frequently asked questions using keyword and word-overlap matching with configurable similarity thresholds and optional escalation to a live agent.

**Source:** `src/prefabs/FAQBotAgent.ts`

### FAQBot Configuration

The constructor accepts a `FAQBotConfig` object:

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | No | `"FAQBot"` | Agent display name. |
| `faqs` | `FAQEntry[]` | **Yes** | -- | List of FAQ entries for the knowledge base. |
| `threshold` | `number` | No | `0.5` | Minimum match score (0--1) for an FAQ to be considered a match. |
| `escalationMessage` | `string` | No | `"I'm sorry, I couldn't find an answer to your question. Let me transfer you to someone who can help."` | Message spoken when no FAQ matches the query. |
| `escalationNumber` | `string` | No | -- | Phone number to transfer to on escalation. If not set, the `escalate` tool is **not registered**. |
| `agentOptions` | `Partial<AgentOptions>` | No | -- | Additional AgentBase options. |

Each `FAQEntry` has the following shape:

| Property | Type | Required | Description |
|---|---|---|---|
| `question` | `string` | **Yes** | The representative question text. |
| `answer` | `string` | **Yes** | The answer to provide when this FAQ matches. |
| `keywords` | `string[]` | No | Additional keywords to boost matching accuracy. |

### FAQBot Matching Engine

The matching engine computes a word-overlap similarity score between the caller's query and each FAQ entry.

**Tokenization:**
1. Text is lowercased.
2. Non-alphanumeric characters are replaced with spaces.
3. Text is split on whitespace.
4. Words shorter than 2 characters are removed.
5. Common English stop words are filtered out (e.g., "the", "is", "to", "and", "or", etc.).

**Scoring:**
- **Question overlap** -- the number of shared tokens between the query and the FAQ question text, normalized by the smaller token set.
- **Keyword overlap** -- each keyword is checked for substring presence in the lowercased query; the hit count is divided by total keywords.
- **Combined score** -- if keywords are present, the final score is `0.6 * questionOverlap + 0.4 * keywordScore`. Without keywords, only question overlap is used.

The best-scoring FAQ is returned if its score meets or exceeds the configured `threshold`. Runner-up matches above the threshold are mentioned as related results.

### FAQBot Tools

#### `search_faq`

Searches the FAQ knowledge base for an answer to the caller's question.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | Yes | The caller's question or search query. |

**Returns:** The best matching FAQ entry with confidence score, plus up to 2 related runner-ups if they also exceed the threshold. If no match meets the threshold, returns the escalation message.

#### `escalate`

Transfers the caller to a live agent. **Only registered when `escalationNumber` is configured.**

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `reason` | `string` | No | The reason for escalation. Defaults to `"Caller needs assistance beyond FAQ"`. |

**Behavior:** Uses `FunctionResult.connect()` to transfer the call to the configured `escalationNumber`.

### FAQBot Example

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

agent.start();
```

---

## ConciergeAgent

A virtual concierge for a venue or business. Provides information about services, amenities, and hours of operation, and answers availability and directions questions.

**Source:** `src/prefabs/ConciergeAgent.ts`

### Concierge Configuration

The constructor accepts a `ConciergeConfig` object:

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | No | `"concierge"` | Agent display name. |
| `route` | `string` | No | `"/concierge"` | HTTP route for this agent. |
| `venueName` | `string` | **Yes** | -- | Name of the venue or business. |
| `services` | `string[]` | **Yes** | -- | List of services offered. |
| `amenities` | `Record<string, Record<string, string>>` | **Yes** | -- | Amenities as an object of amenity-name → detail-pairs. |
| `hoursOfOperation` | `Record<string, string>` | No | `{ default: '9 AM - 5 PM' }` | Operating hours by category. |
| `specialInstructions` | `string[]` | No | `[]` | Extra instruction bullets to append. |
| `welcomeMessage` | `string` | No | -- | When set, installed as a non-bargeable static greeting. |
| `agentOptions` | `Partial<AgentOptions>` | No | -- | Additional AgentBase options. |

The venue name, all services, and amenity names are added as speech recognition hints.

### Concierge Tools

#### `check_availability`

Checks whether a given service is offered on a specified date and time.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `service` | `string` | Yes | The service to check. |
| `date` | `string` | Yes | The date in `YYYY-MM-DD` format. |
| `time` | `string` | Yes | The time in `HH:MM` 24-hour format. |

**Returns:** A confirmation or a list of offered services when the requested service is not available.

#### `get_directions`

Looks up directions for an amenity by name.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `location` | `string` | Yes | The amenity or location to get directions to. |

**Returns:** Directions referencing the amenity's `location` detail, or a fallback pointing the caller to the front desk.

### Concierge Example

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
  welcomeMessage: 'Welcome to the Grand Hotel! How may I assist you?',
});

agent.run();
```

---

## ReceptionistAgent

A front-desk agent that greets callers, collects their name and reason for calling, and transfers them to the appropriate department. Optionally supports visitor check-in as a TS-specific enhancement.

**Source:** `src/prefabs/ReceptionistAgent.ts`

### Receptionist Configuration

The constructor accepts a `ReceptionistConfig` object:

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | No | `"receptionist"` | Agent display name. |
| `route` | `string` | No | `"/receptionist"` | HTTP route for this agent. |
| `departments` | `ReceptionistDepartment[]` | **Yes** | -- | Departments the agent can transfer callers to. |
| `greeting` | `string` | No | `"Thank you for calling. How can I help you today?"` | Initial greeting message. |
| `voice` | `string` | No | `"rime.spore"` | Voice identifier passed to `addLanguage`. |
| `companyName` | `string` | No | -- | Optional company name appended to the greeting and used as a speech hint. |
| `checkInEnabled` | `boolean` | No | `false` | Whether the TS-specific `check_in_visitor` tool is registered. |
| `onVisitorCheckIn` | `(visitor: Record<string, string>) => void \| Promise<void>` | No | -- | Callback fired when a visitor checks in. |
| `agentOptions` | `Partial<AgentOptions>` | No | -- | Additional AgentBase options. |

Each `ReceptionistDepartment` has the following shape:

| Property | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | **Yes** | Department identifier (used as enum value in `transfer_call`). |
| `description` | `string` | **Yes** | Description of the department (shown to the AI). |
| `number` | `string` | **Yes** | Phone number (or SIP address) to dial on transfer. |

### Receptionist Tools

#### `collect_caller_info`

Records the caller's name and reason for calling in `global_data.caller_info` via `set_global_data`.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes | The caller's name. |
| `reason` | `string` | Yes | The reason for the call. |

**Returns:** An acknowledgement referencing the caller by name.

#### `transfer_call`

Transfers the caller to the selected department.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `department` | `string` (enum over department names) | Yes | The department to transfer to. |

**Behavior:**
- Uses `post_process=true` so the AI speaks the response before executing the transfer.
- Uses `FunctionResult.connect(number, final=true)` to make the transfer permanent.
- Reads `global_data.caller_info.name` (populated by `collect_caller_info`) to personalize the hand-off message.
- Returns an error if the department name is unknown.

#### `check_in_visitor` (TS enhancement)

Only registered when `checkInEnabled` is `true`. Records a visitor in the per-call session and fires the `onVisitorCheckIn` callback.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `visitor_name` | `string` | Yes | Full name of the visitor. |
| `purpose` | `string` | Yes | Purpose of the visit. |
| `visiting` | `string` | Yes | Name of the person or department the visitor is here to see. |

### Receptionist Example

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
    // Send Slack notification, update visitor log, print badge, etc.
  },
  agentOptions: {
    route: '/reception',
  },
});

agent.start();
```

---

## Factory Functions

Each prefab provides a factory function that creates and returns a new instance. These are simple shorthands for `new PrefabAgent(config)`:

| Factory Function | Creates |
|---|---|
| `createInfoGathererAgent(config)` | `InfoGathererAgent` |
| `createSurveyAgent(config)` | `SurveyAgent` |
| `createFAQBotAgent(config)` | `FAQBotAgent` |
| `createConciergeAgent(config)` | `ConciergeAgent` |
| `createReceptionistAgent(config)` | `ReceptionistAgent` |

Factory functions accept the same config type as their corresponding class constructors.

```typescript
import { createSurveyAgent } from '@signalwire/sdk';

const agent = createSurveyAgent({
  questions: [
    { id: 'q1', text: 'How was your experience?', type: 'rating' },
  ],
  onComplete: (responses, score) => {
    console.log('Done!', responses, score);
  },
});

agent.start();
```

Factory functions and class constructors are exported both from the individual prefab modules and from the main SDK entry point:

```typescript
// From the SDK entry point
import { createFAQBotAgent, FAQBotAgent } from '@signalwire/sdk';

// From the prefab module directly
import { createFAQBotAgent } from '@signalwire/sdk/prefabs';
```

---

## Subclassing Prefabs

Prefab agents can be subclassed to customize their behavior. The two primary extension points are the static `PROMPT_SECTIONS` array and the `defineTools()` method.

### Overriding `PROMPT_SECTIONS`

Each prefab declares a `static override PROMPT_SECTIONS` array that the `AgentBase` constructor merges into the prompt. You can override this in your subclass to change the AI's role and rules:

```typescript
import { InfoGathererAgent } from '@signalwire/sdk';
import type { InfoGathererConfig } from '@signalwire/sdk';

class SpanishInfoGatherer extends InfoGathererAgent {
  static override PROMPT_SECTIONS = [
    {
      title: 'Role',
      body: 'You are a bilingual information-gathering assistant. You speak Spanish and English. Always respond in the same language the caller uses.',
    },
    {
      title: 'Rules',
      bullets: [
        'Ask one question at a time, in the order provided by start_questions.',
        'Use submit_answer to record each response and advance to the next question.',
        'If a question has confirm=true, insist on confirmation before submitting.',
        'If validation fails, politely ask the caller to try again in their language.',
      ],
    },
  ];

  constructor(config: InfoGathererConfig) {
    super(config);
  }
}
```

### Overriding `defineTools()`

You can override `defineTools()` to add additional tools, replace existing tools, or extend the default tool set by calling `super.defineTools()` first:

```typescript
import { FAQBotAgent, FunctionResult } from '@signalwire/sdk';
import type { FAQBotConfig } from '@signalwire/sdk';

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
        return new FunctionResult('Thank you for your feedback!');
      },
    });
  }
}
```

### Adding Dynamic Prompt Sections

Beyond the static `PROMPT_SECTIONS`, you can use `this.promptAddSection()` in the constructor body to add additional dynamic prompt content:

```typescript
import { ConciergeAgent } from '@signalwire/sdk';
import type { ConciergeConfig } from '@signalwire/sdk';

class HolidayConcierge extends ConciergeAgent {
  constructor(config: ConciergeConfig) {
    super(config);

    // Add a holiday schedule section to the prompt
    this.promptAddSection('Holiday Schedule', {
      body: 'Note: The office is closed on December 25th and January 1st. All departments will reopen on January 2nd.',
    });
  }
}
```
