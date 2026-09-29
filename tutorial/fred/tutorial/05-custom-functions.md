# Lesson 5: Creating Custom Functions

Skills cover common capabilities, and your own functions cover the rest. This lesson writes `share_fun_fact`, a SWAIG function that shares facts about Wikipedia, and explains how the model calls it. It then finishes `fred.ts` so that it starts a server.

## Table of Contents

1. [Understanding SWAIG Functions](#understanding-swaig-functions)
2. [Creating the Fun Fact Function](#creating-the-fun-fact-function)
3. [The defineTool Method](#the-definetool-method)
4. [Function Implementation](#function-implementation)
5. [Returning Results](#returning-results)
6. [Starting the Server](#starting-the-server)

---

## Understanding SWAIG Functions

SWAIG (SignalWire AI Gateway) functions are tools the model can call during a conversation. They let an agent act, not only talk.

### What Is a SWAIG Function?

A SWAIG function has four properties:

- The model can call it during a conversation
- It receives arguments the model chooses
- It runs your code, such as an API call or a calculation
- It returns a result the model uses in its reply

### Function Flow

A function call moves through five stages:

```text
Caller asks a question -> Model calls the function -> Your code runs -> Result returns to the model -> Model answers the caller
```

## Creating the Fun Fact Function

The first version of the function picks a random fact from a list.

### Step 1: Override defineTools

`AgentBase` has a `defineTools()` method for a subclass to override. The SDK calls it once, the first time it needs the agent's functions: when it renders the SWML, lists the tools, or handles a function call. The method runs after the constructor has finished, so everything the constructor set up is ready.

First, add `FunctionResult` to the import at the top of `fred.ts`:

```typescript
import { AgentBase, FunctionResult, WikipediaSearchSkill } from '@signalwire/sdk';
```

Then add this method inside the `FredTheWikiBot` class, after the constructor:

<!-- snippet: no-compile a method of the FredTheWikiBot class, which goes inside the class body in fred.ts -->
```typescript
  /** Register Fred's own tool. The SDK calls this once, the first time it needs the tools. */
  protected override defineTools(): void {
    this.defineTool({
      name: 'share_fun_fact',
      description: 'Share a fun fact about Wikipedia itself',
      parameters: {},
      handler: () => {
        const facts = [
          'Wikipedia has over 6 million articles in English alone!',
          'Wikipedia is available in more than 300 languages!',
          'Wikipedia was launched on January 15, 2001!',
          'The most edited Wikipedia page is about George W. Bush!',
          'Wikipedia is the 7th most visited website in the world!',
        ];
        const fact = facts[Math.floor(Math.random() * facts.length)];
        return new FunctionResult(`Here's a fun Wikipedia fact: ${fact}`);
      },
    });
  }
```

### Understanding the Code

The method has three parts.

**The override** is a method of the class. `protected override` says it replaces `AgentBase`'s own `defineTools()`, which registers nothing.

**The definition** is the object `defineTool()` takes: the function's name, the description the model reads, and its parameters. This version has no parameters.

**The handler** is the code that runs when the model calls the function. It returns a `FunctionResult` with the text the model receives. A handler receives three arguments, all optional to declare:

- `args`: the arguments the model chose, as an object
- `rawData`: the whole request from SignalWire, including `call_id` and `global_data`
- `agent`: the agent that received the request

## The defineTool Method

`defineTool()` registers a function as a SWAIG tool. It takes an object with a name, a description, a parameter schema and a handler.

### defineTool Options

Each option has a role:

- `name`: the function's name. The model calls the function by it, so it must be unique in the agent.
- `description`: what the function does. The model reads it on every turn to decide when to call the function, so it matters more than it looks.
- `parameters`: one entry per argument, each with a JSON Schema `type`, a `description`, and an optional `enum` of allowed values
- `required`: the names of the arguments the model must supply
- `handler`: the function that runs, which returns a `FunctionResult`, a string or an object, or a promise of one

### Example with Parameters

This example function takes two parameters, and requires one of them. The SDK reads the types from `parameters`. In the handler, `args.category` has the type of the four `enum` values, and `args.limit` is a number or `undefined`:

```typescript
import { AgentBase, FunctionResult } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'librarian', route: '/librarian' });

agent.defineTool({
  name: 'search_by_category',
  description: 'Search Wikipedia articles in a specific category',
  parameters: {
    category: {
      type: 'string',
      description: 'Category to search in',
      enum: ['science', 'history', 'geography', 'people'],
    },
    limit: {
      type: 'integer',
      description: 'Maximum results to return',
    },
  },
  required: ['category'],
  handler: (args) => {
    const limit = args.limit ?? 3;
    // Implementation here
    return new FunctionResult(`Found ${limit} articles in ${args.category}`);
  },
});
```

## Function Implementation

The final version groups facts by category, and lets the model ask for one.

### Step 2: Fun Fact Function With Categories

The facts move out of the handler into a constant at the top level of `fred.ts`, between the import and the class:

<!-- include: tutorial/fred/fred.ts#facts -->
```typescript
/** Facts about Wikipedia, by category, for the share_fun_fact tool. */
const FACTS = {
  statistics: [
    'Wikipedia has over 6 million articles in English alone!',
    'Wikipedia is available in more than 300 languages!',
    'Wikipedia receives over 18 billion page views per month!',
    'There are over 100,000 active Wikipedia contributors!',
  ],
  history: [
    'Wikipedia was launched on January 15, 2001!',
    "The first Wikipedia article was about the letter 'U'!",
    "Wikipedia's name comes from 'wiki' (Hawaiian for 'quick') and 'encyclopedia'!",
    'Jimmy Wales and Larry Sanger founded Wikipedia!',
  ],
  records: [
    'The most edited Wikipedia page is about George W. Bush!',
    'The longest Wikipedia article is about California Proposition 8!',
    'Wikipedia is the 7th most visited website in the world!',
    "The Wikipedia article on 'List of Pokemon' is one of the most viewed!",
  ],
};
```

Then replace the `defineTools()` method with this version:

<!-- include: tutorial/fred/fred.ts#fun-fact --> <!-- snippet: no-compile a quote of a method in tutorial/fred/fred.ts, which tsc checks whole -->
```typescript
  /** Register Fred's own tool. The SDK calls this once, the first time it needs the tools. */
  protected override defineTools(): void {
    this.defineTool({
      name: 'share_fun_fact',
      description: 'Share an interesting fact about Wikipedia itself',
      parameters: {
        category: {
          type: 'string',
          description: 'Type of fact to share',
          enum: ['statistics', 'history', 'records', 'random'],
        },
      },
      handler: (args) => {
        // The model may leave the category out, so default to random
        const category = args.category ?? 'random';

        // The enum guides the model but doesn't bind it: random, or any
        // category Fred doesn't have, draws from every fact
        const known = category !== 'random' && Object.hasOwn(FACTS, category);
        const factList = known ? FACTS[category] : Object.values(FACTS).flat();
        const fact = factList[Math.floor(Math.random() * factList.length)];

        // Say what kind of fact it is, so the model can introduce it
        if (known) {
          return new FunctionResult(`Here's a ${category} fact about Wikipedia: ${fact}`);
        }
        return new FunctionResult(`Here's a fun Wikipedia fact: ${fact}`);
      },
    });
  }
```

`category` isn't in a `required` list, so its type includes `undefined`. `Object.values(FACTS).flat()` joins the three lists into one, for a random fact.

### Practices for Function Implementation

Three habits keep functions reliable.

1. **Give every optional argument a default.** The model may leave it out.

   <!-- snippet: no-compile a statement from inside the share_fun_fact handler, where args is defined -->
   ```typescript
   const category = args.category ?? 'random';
   ```

2. **Don't rely on the schema alone.** The `enum` and the TypeScript types describe what the model should send, not what it sends. The SDK checks each request's arguments against the schema, logs a warning when they don't match, and runs the handler anyway. Fred handles a category it doesn't have like `random`. `swaig-test`, which [Lesson 6](06-running-testing.md#testing-with-swaig-test) covers, shows it:

   ```bash
   npx swaig-test fred.ts --verbose --exec share_fun_fact --category science
   ```

   Among the debug lines, the warning and the result appear:

   ```text
   2026-09-29T17:38:19.131Z [WARN] [SwaigFunction] Argument validation failed for function 'share_fun_fact': 'category' must be equal to one of the allowed values
   RESULT:
   Response: Here's a fun Wikipedia fact: The Wikipedia article on 'List of Pokemon' is one of the most viewed!
   ```

3. **Say what the result is.** Context in the response helps the model use it.

   <!-- snippet: no-compile a statement from inside the share_fun_fact handler, where category and fact are defined -->
   ```typescript
   return new FunctionResult(`Here's a ${category} fact about Wikipedia: ${fact}`);
   ```

## Returning Results

A SWAIG function returns a `FunctionResult`. It carries text for the model, and can also carry actions for the platform to carry out.

### Basic Result

The simplest result is text for the model:

<!-- snippet: no-compile a return statement from inside a handler -->
```typescript
return new FunctionResult('Simple text response');
```

### Result with Actions

Helper methods add actions. This one plays an audio file in the background while the conversation continues:

<!-- snippet: no-compile a return statement from inside a handler -->
```typescript
return new FunctionResult('Playing background music').playBackgroundFile(
  'https://example.com/music.mp3',
);
```

### Multiple Actions

The helpers return the result, so you can chain them. Actions run in order, so here the caller hears the sentence before the transfer starts:

<!-- snippet: no-compile a return statement from inside a handler -->
```typescript
return new FunctionResult('Transferring the caller')
  .say('One moment while I connect you.')
  .connect('+15555550100');
```

### Common Actions

These helper methods cover the most common actions:

- `say(text)`: speak a fixed sentence
- `connect(destination)`: transfer the call
- `hangup()`: end the call
- `playBackgroundFile(url)`: play audio in the background
- `stopBackgroundFile()`: stop the background audio
- `updateGlobalData(data)`: change the call's global data
- `sendSms({ toNumber, fromNumber, body })`: send a text message

For every action, see the [SWAIG reference](../../../docs/swaig-reference.md).

## Starting the Server

Fred's functions are complete. The last part of `fred.ts` replaces the test lines from Lesson 4 with code that starts the server, and the import gains one more name:

<!-- include: tutorial/fred/fred.ts#imports -->
```typescript
import { pathToFileURL } from 'node:url';

import { AgentBase, FunctionResult, WikipediaSearchSkill } from '@signalwire/sdk';
```

Replace the test lines at the end of the file with these:

<!-- include: tutorial/fred/fred.ts#main --> <!-- snippet: no-compile a quote from the end of tutorial/fred/fred.ts, which tsc checks whole -->
```typescript
// swaig-test imports this file, and finds Fred through this export
export const fred = await createFred();

// Print the banner and start the server only when this file is the program
// that runs, not when another program imports it
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [username, password] = fred.getBasicAuthCredentials();

  console.log('='.repeat(60));
  console.log('Fred: a Wikipedia knowledge bot');
  console.log('='.repeat(60));
  console.log();
  console.log('Fred searches Wikipedia and shares facts about Wikipedia itself.');
  console.log();
  console.log('Questions to try:');
  console.log('  - Tell me about Albert Einstein');
  console.log('  - What is quantum physics?');
  console.log('  - Who was Marie Curie?');
  console.log('  - Search for information about the solar system');
  console.log('  - Can you share a fun fact?');
  console.log();
  console.log(`Fred is available at: http://localhost:${fred.port}/fred`);
  console.log(`Basic Auth: ${username}:${password}`);
  console.log();
  console.log('Starting Fred. Press Ctrl+C to stop.');
  console.log('='.repeat(60));

  await fred.run();
}
```

The code does three things:

- `export const fred` makes the finished agent available to any program that imports `fred.ts`. The SDK's `swaig-test` tool imports the file and looks for an exported agent.
- The `if` compares this file's address with the file Node.js was asked to run, `process.argv[1]`. They match when you run `fred.ts`, and don't when `swaig-test` imports it, so testing Fred prints no banner and starts no server.
- `getBasicAuthCredentials()` returns the username and password Fred checks, and `run()` starts the HTTP server on the port in `fred.port`, 3000 unless `PORT` is set.

Lesson 6 runs it. The complete file is in [Appendix A](appendix-complete-code.md#complete-fredts).

## Next Steps

Fred can search Wikipedia and share facts about it. Next, run Fred and test both functions. Continue with [Lesson 6: Running and Testing Fred](06-running-testing.md).

---

[Previous: Wikipedia Skill](04-wikipedia-skill.md) | [Overview](README.md) | [Next: Running and Testing](06-running-testing.md)
