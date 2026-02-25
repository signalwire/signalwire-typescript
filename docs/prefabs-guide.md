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
} from 'signalwire-agents';
```

---

## InfoGathererAgent

A conversational agent that sequentially collects named fields from a caller, validates each value against optional regex patterns, and fires a completion callback once all required fields are gathered.

**Source:** `src/prefabs/InfoGathererAgent.ts`

### InfoGatherer Configuration

The constructor accepts an `InfoGathererConfig` object:

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | No | `"InfoGatherer"` | Agent display name. |
| `fields` | `InfoGathererField[]` | **Yes** | -- | Fields to collect from the caller. |
| `introMessage` | `string` | No | `"Hello! I need to collect some information from you. Let me walk you through it."` | Opening message the agent speaks when the call starts. |
| `confirmationMessage` | `string` | No | `"Thank you! I have collected all the required information."` | Message spoken after all required fields are gathered. |
| `onComplete` | `(data: Record<string, string>) => void \| Promise<void>` | No | -- | Callback fired when all required fields have been collected. Receives a copy of the collected data. |
| `agentOptions` | `Partial<AgentOptions>` | No | -- | Additional AgentBase options forwarded to `super()` (e.g., `route`, `port`, `basicAuth`). |

### InfoGatherer Fields

Each entry in the `fields` array is an `InfoGathererField`:

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | **Yes** | -- | Unique field name, used as the key in collected data. |
| `description` | `string` | **Yes** | -- | Human-readable description shown to the AI agent. |
| `required` | `boolean` | No | `true` | Whether this field must be collected before completion. |
| `validation` | `RegExp \| string` | No | -- | Optional validation pattern. Strings are compiled to `RegExp`. |

Fields are presented to the AI prompt as a numbered list, each annotated with `(required)` or `(optional)` and the validation pattern source if present.

### InfoGatherer Tools

The agent registers two SWAIG tools:

#### `save_field`

Saves a collected field value from the caller. Validates the value if a validation pattern is configured.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `field_name` | `string` | Yes | The name of the field to save. |
| `value` | `string` | Yes | The value provided by the caller. |

**Behavior:**
- Returns an error if the field name is unknown, listing available fields.
- Runs the value against the field's validation regex (if configured). Returns a validation error with the expected pattern if it fails.
- Saves the value into the per-call session.
- If this save completes all required fields and `onComplete` has not yet fired, fires the `onComplete` callback with a shallow copy of the collected data and returns the confirmation message with a summary.
- Otherwise, returns the list of remaining required fields.

#### `get_status`

Returns the current status of information gathering.

**Parameters:** None.

**Returns:** A string summarizing collected fields, remaining required fields, and remaining optional fields.

### InfoGatherer Session Tracking

Session state is keyed by `call_id` from the raw POST data. Each session tracks:

- `collected` -- a `Record<string, string>` of field name to value.
- `completeFired` -- a boolean ensuring the `onComplete` callback fires at most once per call.

When a call comes in without a `call_id`, the fallback key `"default"` is used.

### InfoGatherer Example

```typescript
import { InfoGathererAgent } from 'signalwire-agents';

const agent = new InfoGathererAgent({
  name: 'PatientIntake',
  introMessage: 'Welcome to our clinic! I need to collect some information before your appointment.',
  confirmationMessage: 'Thank you! Your information has been saved. A nurse will be with you shortly.',
  fields: [
    {
      name: 'full_name',
      description: 'The patient\'s full legal name',
      required: true,
    },
    {
      name: 'date_of_birth',
      description: 'Date of birth in MM/DD/YYYY format',
      required: true,
      validation: /^\d{2}\/\d{2}\/\d{4}$/,
    },
    {
      name: 'phone_number',
      description: 'Contact phone number',
      required: true,
      validation: '^\\+?\\d{10,15}$',
    },
    {
      name: 'insurance_provider',
      description: 'Name of the insurance provider',
      required: false,
    },
  ],
  onComplete: async (data) => {
    console.log('Patient intake complete:', data);
    // Save to database, send notification, etc.
  },
  agentOptions: {
    port: 3001,
    route: '/intake',
  },
});

agent.start();
```

---

## SurveyAgent

A conversational agent that conducts surveys with multiple question types, branching logic based on answers, and per-answer scoring.

**Source:** `src/prefabs/SurveyAgent.ts`

### Survey Configuration

The constructor accepts a `SurveyConfig` object:

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | No | `"SurveyAgent"` | Agent display name. |
| `questions` | `SurveyQuestion[]` | **Yes** | -- | Ordered list of survey questions. |
| `introMessage` | `string` | No | `"Thank you for taking our survey. I have a few questions for you."` | Opening message before the first question. |
| `completionMessage` | `string` | No | `"Thank you for completing the survey! Your responses have been recorded."` | Message spoken after the survey is complete. |
| `onComplete` | `(responses: Record<string, unknown>, score: number) => void \| Promise<void>` | No | -- | Callback fired when the survey is finished. Receives all responses and the total score. |
| `agentOptions` | `Partial<AgentOptions>` | No | -- | Additional AgentBase options. |

Each `SurveyQuestion` has the following shape:

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | **Yes** | Unique question identifier. |
| `text` | `string` | **Yes** | The question text to ask the caller. |
| `type` | `'multiple_choice' \| 'open_ended' \| 'rating' \| 'yes_no'` | **Yes** | Question type; determines validation and display. |
| `options` | `string[]` | No | Answer options (used when `type` is `multiple_choice`). |
| `nextQuestion` | `string \| Record<string, string>` | No | Controls flow after this question (see Branching Logic). |
| `points` | `number \| Record<string, number>` | No | Points awarded for answers (see Scoring). |

### Survey Question Types

| Type | Validation | Notes |
|---|---|---|
| `multiple_choice` | Answer must exactly match one of the `options` (case-insensitive). | All options are read aloud. |
| `open_ended` | No validation; any answer is accepted. | Free-form response. |
| `rating` | Must be an integer between 1 and 10. | The AI specifies the scale to the caller. |
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

The agent registers three SWAIG tools:

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
import { SurveyAgent } from 'signalwire-agents';

const agent = new SurveyAgent({
  name: 'CustomerSatisfaction',
  introMessage: 'Hi! We would love to hear your feedback about our service.',
  completionMessage: 'Thanks for your feedback! We really appreciate it.',
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

**Behavior:** Uses `SwaigFunctionResult.connect()` to transfer the call to the configured `escalationNumber`.

### FAQBot Example

```typescript
import { FAQBotAgent } from 'signalwire-agents';

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

A multi-department routing agent that provides callers with department information, hours of operation, and call transfer capabilities.

**Source:** `src/prefabs/ConciergeAgent.ts`

### Concierge Configuration

The constructor accepts a `ConciergeConfig` object:

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | No | `"Concierge"` | Agent display name. |
| `departments` | `Department[]` | **Yes** | -- | List of departments available for routing. |
| `companyName` | `string` | No | `"our company"` | Company name used in greetings and prompts. |
| `generalInfo` | `string` | No | `""` | General company information the agent can share. |
| `afterHoursMessage` | `string` | No | `"This department is currently closed. Please try again during business hours."` | Message spoken when a department is closed or has no transfer number. |
| `agentOptions` | `Partial<AgentOptions>` | No | -- | Additional AgentBase options. |

Each `Department` has the following shape:

| Property | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | **Yes** | Department name (e.g., "Sales", "Support"). |
| `description` | `string` | **Yes** | Description of what the department handles. |
| `transferNumber` | `string` | No | Phone number or SIP address for transfers. |
| `keywords` | `string[]` | No | Keywords that help route callers to this department. |
| `hoursOfOperation` | `string` | No | Human-readable hours (e.g., "Mon-Fri 9am-5pm EST"). |

Department names and keywords are added as speech recognition hints. Department lookup supports matching by name or by keyword (both case-insensitive).

### Concierge Tools

#### `list_departments`

Lists all available departments with their descriptions and hours of operation.

**Parameters:** None.

**Returns:** A formatted list of every department including name, description, hours, and whether direct transfer is available.

#### `get_department_info`

Gets detailed information about a specific department.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `department_name` | `string` | Yes | The name of the department to look up. |

**Returns:** Department name, description, hours of operation, transfer availability, and related topics (keywords). Returns an error with available department names if the department is not found.

#### `transfer_to_department`

Transfers the caller to a specific department.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `department_name` | `string` | Yes | The name of the department to transfer to. |

**Behavior:**
- Looks up the department by name or keyword (case-insensitive).
- Returns an error if the department is not found.
- Returns the `afterHoursMessage` if the department has no `transferNumber`.
- Uses `SwaigFunctionResult.connect()` to initiate the transfer.

### Concierge Example

```typescript
import { ConciergeAgent } from 'signalwire-agents';

const agent = new ConciergeAgent({
  name: 'MainLine',
  companyName: 'Acme Corporation',
  generalInfo: 'Acme Corporation is a leading provider of innovative solutions since 1985.',
  afterHoursMessage: 'That department is currently closed. Please call back during business hours or leave a voicemail.',
  departments: [
    {
      name: 'Sales',
      description: 'New product inquiries, pricing, and demos',
      transferNumber: '+15551001001',
      keywords: ['buy', 'purchase', 'pricing', 'demo', 'quote'],
      hoursOfOperation: 'Mon-Fri 8am-6pm EST',
    },
    {
      name: 'Technical Support',
      description: 'Help with existing products, troubleshooting, and bug reports',
      transferNumber: '+15551001002',
      keywords: ['help', 'broken', 'issue', 'bug', 'problem', 'error'],
      hoursOfOperation: 'Mon-Fri 9am-9pm EST, Sat 10am-4pm EST',
    },
    {
      name: 'Billing',
      description: 'Invoices, payments, and subscription management',
      transferNumber: '+15551001003',
      keywords: ['invoice', 'payment', 'bill', 'subscription', 'charge'],
      hoursOfOperation: 'Mon-Fri 9am-5pm EST',
    },
    {
      name: 'Human Resources',
      description: 'Employment opportunities and employee services',
      keywords: ['job', 'career', 'hiring', 'employment'],
      // No transferNumber -- caller will get afterHoursMessage
    },
  ],
});

agent.start();
```

---

## ReceptionistAgent

A front-desk agent that handles visitor check-in, department directory lookup, and call transfers by extension.

**Source:** `src/prefabs/ReceptionistAgent.ts`

### Receptionist Configuration

The constructor accepts a `ReceptionistConfig` object:

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | No | `"Receptionist"` | Agent display name. |
| `companyName` | `string` | **Yes** | -- | Company name displayed in greetings and prompts. |
| `departments` | `ReceptionistDepartment[]` | **Yes** | -- | Departments with extensions for the directory. |
| `welcomeMessage` | `string` | No | `"Welcome to {companyName}! How may I help you today?"` | Custom welcome message. |
| `checkInEnabled` | `boolean` | No | `true` | Whether visitor check-in functionality is enabled. |
| `onVisitorCheckIn` | `(visitor: Record<string, string>) => void \| Promise<void>` | No | -- | Callback fired when a visitor checks in. |
| `agentOptions` | `Partial<AgentOptions>` | No | -- | Additional AgentBase options. |

Each `ReceptionistDepartment` has the following shape:

| Property | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | **Yes** | Department name (e.g., "Engineering", "HR"). |
| `extension` | `string` | **Yes** | Internal extension number or SIP address. |
| `description` | `string` | No | Description of the department. |

The company name and all department names are added as speech recognition hints. Department lookup is by name (case-insensitive).

### Receptionist Tools

#### `get_department_list`

Lists all departments with their extensions and descriptions.

**Parameters:** None.

**Returns:** A formatted department directory for the company.

#### `transfer_to_department`

Transfers the caller to a department by dialing its extension.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `department_name` | `string` | Yes | The name of the department to transfer to. |

**Behavior:**
- Looks up the department by name (case-insensitive).
- Returns an error with the list of available departments if not found.
- Uses `SwaigFunctionResult.connect()` to dial the extension.

#### `check_in_visitor`

Checks in a visitor by recording their details. **Only registered when `checkInEnabled` is `true` (the default).**

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `visitor_name` | `string` | Yes | Full name of the visitor. |
| `purpose` | `string` | Yes | Purpose of the visit. |
| `visiting` | `string` | Yes | Name of the person or department the visitor is here to see. |

**Behavior:**
- Validates that all three parameters are provided.
- Creates a visitor record including `visitor_name`, `purpose`, `visiting`, and `checked_in_at` (ISO timestamp).
- Stores the record in the per-call session.
- Fires the `onVisitorCheckIn` callback with the visitor record.
- Returns a confirmation message.

### Receptionist Example

```typescript
import { ReceptionistAgent } from 'signalwire-agents';

const agent = new ReceptionistAgent({
  companyName: 'Acme Corporation',
  welcomeMessage: 'Hello and welcome to Acme Corporation! I can help you find a department, transfer your call, or check you in as a visitor.',
  checkInEnabled: true,
  departments: [
    {
      name: 'Engineering',
      extension: '1001',
      description: 'Software development and technical teams',
    },
    {
      name: 'Human Resources',
      extension: '1002',
      description: 'Employee services, benefits, and recruiting',
    },
    {
      name: 'Marketing',
      extension: '1003',
      description: 'Brand, communications, and events',
    },
    {
      name: 'Executive Office',
      extension: '1004',
      description: 'CEO and executive leadership',
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
import { createSurveyAgent } from 'signalwire-agents';

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
import { createFAQBotAgent, FAQBotAgent } from 'signalwire-agents';

// From the prefab module directly
import { createFAQBotAgent } from 'signalwire-agents/prefabs';
```

---

## Subclassing Prefabs

Prefab agents can be subclassed to customize their behavior. The two primary extension points are the static `PROMPT_SECTIONS` array and the `defineTools()` method.

### Overriding `PROMPT_SECTIONS`

Each prefab declares a `static override PROMPT_SECTIONS` array that the `AgentBase` constructor merges into the prompt. You can override this in your subclass to change the AI's role and rules:

```typescript
import { InfoGathererAgent } from 'signalwire-agents';
import type { InfoGathererConfig } from 'signalwire-agents';

class SpanishInfoGatherer extends InfoGathererAgent {
  static override PROMPT_SECTIONS = [
    {
      title: 'Role',
      body: 'You are a bilingual information-gathering assistant. You speak Spanish and English. Always respond in the same language the caller uses.',
    },
    {
      title: 'Rules',
      bullets: [
        'Ask for one field at a time, in the order listed.',
        'If the caller provides information for a later field, accept it and move on.',
        'Always confirm each piece of information before saving it using the save_field tool.',
        'If validation fails, politely ask the caller to try again in their language.',
        'Use the get_status tool when you need to check progress.',
        'Once all required fields are collected, summarize the information and confirm with the caller.',
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
import { FAQBotAgent, SwaigFunctionResult } from 'signalwire-agents';
import type { FAQBotConfig } from 'signalwire-agents';

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
        return new SwaigFunctionResult('Thank you for your feedback!');
      },
    });
  }
}
```

### Adding Dynamic Prompt Sections

Beyond the static `PROMPT_SECTIONS`, you can use `this.promptAddSection()` in the constructor body to add additional dynamic prompt content:

```typescript
import { ConciergeAgent } from 'signalwire-agents';
import type { ConciergeConfig } from 'signalwire-agents';

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
