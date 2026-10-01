# Lesson 3: Creating Fred's Basic Structure

This lesson builds Fred's foundation: the agent class, the prompt that sets its persona, its voice, and its conversation settings. Fred can't search anything yet. Lesson 4 adds that.

## Table of Contents

1. [Creating the Agent Class](#creating-the-agent-class)
2. [Defining Fred's Personality](#defining-freds-personality)
3. [Configuring Voice and Language](#configuring-voice-and-language)
4. [Setting Conversation Parameters](#setting-conversation-parameters)
5. [Adding Speech Recognition Hints](#adding-speech-recognition-hints)
6. [Testing the Basic Structure](#testing-the-basic-structure)

---

## Creating the Agent Class

Fred is a class that extends `AgentBase`. Create a new file called `fred.ts` in the project directory.

### Step 1: Import and Class Definition

Start with the import and the class:

```typescript
/**
 * Fred: a Wikipedia knowledge bot
 *
 * An agent that searches Wikipedia and shares facts about Wikipedia itself,
 * with a friendly, curious persona.
 *
 * Run: npx tsx fred.ts
 */

import { AgentBase } from '@signalwire/sdk';

/** Fred, a Wikipedia assistant with a friendly persona. */
export class FredTheWikiBot extends AgentBase {
  constructor() {
    super({ name: 'Fred', route: '/fred' });
  }
}
```

Each part has a job:

- `AgentBase` is the SDK class every agent is built from. Lessons 4 and 5 add two more names to this import.
- `export` lets other files, and the SDK's test tool, use the class
- `name: 'Fred'` is the agent's name
- `route: '/fred'` is the agent's HTTP path, so Fred answers at `http://localhost:3000/fred`

Every step in the rest of this lesson adds code inside the constructor, after the `super()` call.

## Defining Fred's Personality

The prompt tells the model who Fred is and how to behave. The SDK builds it from named sections, using the Prompt Object Model (POM).

### Step 2: Add Personality Section

The first section sets the persona:

<!-- include: tutorial/fred/fred.ts#personality --> <!-- snippet: no-compile a quote from inside the constructor in tutorial/fred/fred.ts, which tsc checks whole -->
```typescript
    // Set up Fred's personality with the Prompt Object Model
    this.promptAddSection('Personality', {
      body:
        'You are Fred, a friendly and knowledgeable assistant who loves learning and ' +
        "sharing information from Wikipedia. You're enthusiastic about facts and always " +
        'eager to help people discover new things.',
    });
```

`promptAddSection()` takes the section's title and an object with its content. A section has a `body`, a list of `bullets`, or both.

### Step 3: Add Goal and Instructions

Two more sections give Fred a goal and specific instructions:

<!-- include: tutorial/fred/fred.ts#goal --> <!-- snippet: no-compile a quote from inside the constructor in tutorial/fred/fred.ts, which tsc checks whole -->
```typescript
    this.promptAddSection('Goal', {
      body:
        'Help users find reliable factual information by searching Wikipedia. ' +
        'Make learning fun and engaging.',
    });

    this.promptAddSection('Instructions', {
      bullets: [
        'Introduce yourself as Fred when greeting users',
        'Use the search_wiki function whenever users ask about factual topics',
        'Be enthusiastic about sharing knowledge',
        'Search before you say Wikipedia has nothing on a topic, even one that sounds made up',
        "If Wikipedia doesn't have information, suggest alternative search terms",
        'Make learning conversational and enjoyable',
        'Add interesting context or follow-up questions to engage users',
      ],
    });
```

Each section has a purpose:

- **Personality**: Fred's character and tone
- **Goal**: what Fred is for
- **Instructions**: specific behavior, as bullet points

The instructions name `search_wiki`, the function Lesson 4 adds. The fourth bullet comes from testing. Without it, the model sometimes decided a topic sounded made up, and said Wikipedia had nothing on it without searching.

## Configuring Voice and Language

A language entry sets the voice Fred speaks with, and the phrases it can say while it thinks.

### Step 4: Add Language Configuration

Add the language after the prompt sections:

<!-- include: tutorial/fred/fred.ts#voice --> <!-- snippet: no-compile a quote from inside the constructor in tutorial/fred/fred.ts, which tsc checks whole -->
```typescript
    // Configure Fred's voice
    this.addLanguage({
      name: 'English',
      code: 'en-US',
      voice: 'rime.bolt', // A friendly, energetic voice for Fred
      speechFillers: [
        'Hmm, let me think...',
        "Oh, that's interesting...",
        'Great question!',
        'Let me see...',
      ],
    });
```

The settings work like this:

- `name`: a display name for the language
- `code`: the language code, `en-US` for US English
- `voice`: the text-to-speech voice, written as `provider.voice_name`. `rime.bolt` is the Rime provider's "bolt" voice.
- `speechFillers`: phrases the platform can say while the model prepares a reply

The SWML document spells this setting `fillers`, because Fred sets no function fillers. The agent guide's [Languages](../../../docs/agent-guide.md#languages) section covers the other language settings.

## Setting Conversation Parameters

Parameters control how the conversation runs: which model, who speaks first, and how long a pause ends a turn.

### Step 5: Set AI Parameters

Set the parameters with `setParams()`:

<!-- include: tutorial/fred/fred.ts#params --> <!-- snippet: no-compile a quote from inside the constructor in tutorial/fred/fred.ts, which tsc checks whole -->
```typescript
    // Set conversation parameters
    this.setParams({
      ai_model: 'gpt-4.1-nano', // The model that runs the conversation
      wait_for_user: true, // The caller speaks first
      end_of_speech_timeout: 1000, // Milliseconds of silence that end the caller's turn
      ai_volume: 7, // Voice volume adjustment (-50 to 50, default 0)
      local_tz: 'America/New_York', // Time zone for time-related functions
    });
```

The keys are the SWML schema's own names, in `snake_case`. Each has a range the platform accepts:

- `ai_model`: the model that runs the conversation. The SWML schema lists `gpt-4o-mini` (the default), `gpt-4.1-mini` and `gpt-4.1-nano`. Fred uses `gpt-4.1-nano`, the smallest of the three.
- `wait_for_user`: when `true`, the caller speaks first. When `false`, the agent opens the conversation.
- `end_of_speech_timeout`: how many milliseconds of silence end the caller's turn, from 250 to 10,000. The default is 700.
- `ai_volume`: raises or lowers the agent's voice, from -50 to 50. The default is 0.
- `local_tz`: the agent's time zone, as an IANA name

### Step 6: Add Global Data

Global data is session data that travels with the call:

<!-- include: tutorial/fred/fred.ts#global-data --> <!-- snippet: no-compile a quote from inside the constructor in tutorial/fred/fred.ts, which tsc checks whole -->
```typescript
    // Add some context about Fred
    this.setGlobalData({
      assistant_name: 'Fred',
      specialty: 'Wikipedia knowledge',
      personality_traits: ['friendly', 'curious', 'enthusiastic', 'helpful'],
    });
```

The model doesn't see global data unless a prompt refers to a key, such as `${global_data.specialty}`. Functions receive it with every request, as `rawData.global_data`, so it's a place for facts your code needs during the call.

## Adding Speech Recognition Hints

Hints tell speech recognition which words and phrases to expect.

### Step 7: Add Recognition Hints

Add the words callers are likely to say to Fred:

<!-- include: tutorial/fred/fred.ts#hints --> <!-- snippet: no-compile a quote from inside the constructor in tutorial/fred/fred.ts, which tsc checks whole -->
```typescript
    // Add hints for better speech recognition
    this.addHints([
      'Wikipedia',
      'Fred',
      'tell me about',
      'what is',
      'who is',
      'search for',
      'look up',
    ]);
```

Hints improve recognition accuracy when callers say these words. The order of Steps 2 to 7 doesn't matter to the SDK. The finished `fred.ts` in [Appendix A](appendix-complete-code.md#complete-fredts) adds the hints before the parameters.

## Testing the Basic Structure

Creating Fred doesn't start a server, so a few lines at the end of the file can build it and print what it is. Add them after the class:

<!-- snippet: no-compile continues fred.ts from Step 1, whose FredTheWikiBot class it uses -->
```typescript
// Build Fred without starting a server, and show what it is
const fred = new FredTheWikiBot();
console.log('Fred created.');
console.log(`   Name: ${fred.getName()}`);
console.log(`   Route: ${fred.route}`);
```

Run the file to build the agent and print its name and route:

```bash
npx tsx fred.ts
```

Two warnings from the SDK come first. The first says that Fred doesn't check webhook signatures, and the second says the SDK generated a password, because none is set. [Lesson 6](06-running-testing.md#important-information) covers both. The rest of the output confirms the agent's name and route:

```text
2026-09-29T17:33:25.871Z [WARN] [AgentBase] [signalwire] webhook signature validation is disabled — set signingKey or SIGNALWIRE_SIGNING_KEY to enable
2026-09-29T17:33:25.872Z [WARN] [AgentBase] basic_auth_password_autogenerated: username="Fred". No SWML_BASIC_AUTH_PASSWORD found in environment and no basicAuth passed to the agent constructor. The SDK generated a random password that exists only in this process; external callers will get HTTP 401 unless this process hands it to them (getBasicAuthCredentials()). To fix, set SWML_BASIC_AUTH_USER and SWML_BASIC_AUTH_PASSWORD in your .env, or pass { basicAuth: [user, pass] } to the agent constructor.
Fred created.
   Name: Fred
   Route: /fred
```

The `typecheck` script from [Lesson 2](02-setup.md#the-packagejson-file) runs `tsc` over the file. `tsx` runs a file without checking its types, so run the check after each change:

```bash
npm run typecheck
```

When the types are right, the output shows only the command npm ran:

```text
> fred-bot@1.0.0 typecheck
> tsc --noEmit
```

## Key Concepts Review

This lesson used three of the SDK's building blocks.

### Prompt Object Model (POM)

POM organizes the prompt into named sections:

- Easier to maintain than one long prompt
- Each behavior can be updated in its own section
- A clear structure as the agent grows

### Voice Configuration

The language entry controls how Fred sounds:

- Several text-to-speech providers are available
- Each voice has its own character
- Speech fillers cover the pause while the model prepares a reply

### Global Data

Global data holds session facts:

- Functions receive it with every request
- The model sees a value only when a prompt refers to it
- It can hold any JSON-serializable data

## Next Steps

Fred has a persona and a voice, but it can't search Wikipedia yet. Continue with [Lesson 4: Adding the Wikipedia Search Skill](04-wikipedia-skill.md).

---

[Previous: Environment Setup](02-setup.md) | [Overview](README.md) | [Next: Wikipedia Skill](04-wikipedia-skill.md)
