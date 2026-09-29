# Lesson 4: Adding the Wikipedia Search Skill

Fred's job is answering questions from Wikipedia. Instead of writing the search code, this lesson adds the SDK's `wikipedia_search` skill, configures it, and looks at what the skill does inside the agent.

## Table of Contents

1. [Understanding Skills](#understanding-skills)
2. [Adding the Wikipedia Skill](#adding-the-wikipedia-skill)
3. [Configuring the Skill](#configuring-the-skill)
4. [How Skills Work Internally](#how-skills-work-internally)
5. [Testing Wikipedia Search](#testing-wikipedia-search)
6. [How Fred Uses Wikipedia Search](#how-fred-uses-wikipedia-search)
7. [Skill Benefits](#skill-benefits)

---

## Understanding Skills

Skills are modules that add a capability to an agent, much like plugins.

### What Is a Skill?

A skill has four properties:

- It's a self-contained class with one capability
- It registers its own functions and prompt text with the agent
- It's configured with an object of parameters
- It can be reused across agents

### Available Built-in Skills

The SDK includes several ready-made skills, including:

- `wikipedia_search`: search Wikipedia articles
- `datetime`: get the current date and time
- `math`: perform calculations
- `web_search`: search the web with the Google Custom Search API (needs an API key and the `cheerio` package)
- `weather_api`: get the weather from OpenWeatherMap (needs an API key)

The [Skills System Guide](../../../docs/skills-guide.md#built-in-skills) lists every built-in skill and what it needs.

## Adding the Wikipedia Skill

A skill is a class. You create it, then pass it to the agent's `addSkill()` method.

### Step 1: Basic Skill Addition

`addSkill()` returns a promise, because a skill can do setup work before it's ready. A constructor can't wait for a promise, so the skill doesn't go in Fred's constructor. Instead, an `async` function builds Fred and then adds the skill.

First, add `WikipediaSearchSkill` to the import at the top of `fred.ts`:

```typescript
import { AgentBase, WikipediaSearchSkill } from '@signalwire/sdk';
```

Then add this function after the class:

<!-- snippet: no-compile continues fred.ts, whose FredTheWikiBot class it uses -->
```typescript
/** Build Fred, then add the Wikipedia search skill, which loads asynchronously. */
export async function createFred(): Promise<FredTheWikiBot> {
  const fred = new FredTheWikiBot();

  // Add the Wikipedia search skill
  await fred.addSkill(new WikipediaSearchSkill());

  return fred;
}
```

With that function, Fred can search Wikipedia. The next step tunes the skill for Fred.

### Step 2: Customized Configuration

Replace the function with a version that configures the skill:

<!-- include: tutorial/fred/fred.ts#create --> <!-- snippet: no-compile a quote of the createFred function in tutorial/fred/fred.ts, which tsc checks whole -->
```typescript
/** Build Fred, then add the Wikipedia search skill, which loads asynchronously. */
export async function createFred(): Promise<FredTheWikiBot> {
  const fred = new FredTheWikiBot();

  // Add the Wikipedia search skill with custom configuration
  await fred.addSkill(
    new WikipediaSearchSkill({
      num_results: 2, // Get up to 2 articles for broader coverage
      no_results_message:
        "Oh, I couldn't find anything about '{query}' on Wikipedia. " +
        'Maybe try different keywords or let me know if you meant something else!',
      swaig_fields: {
        fillers: {
          'en-US': [
            'Let me look that up on Wikipedia for you...',
            'Searching Wikipedia for that information...',
            'One moment, checking Wikipedia...',
            'Let me find that in the encyclopedia...',
          ],
        },
      },
    }),
  );

  return fred;
}
```

The configuration keys are `snake_case`, as they are in the SignalWire SDKs for other languages.

## Configuring the Skill

The configuration object has three options.

### Configuration Parameters

Each option changes one part of how the skill behaves:

| Option | Default | What it does |
|---|---|---|
| `num_results` | `1` | The number of Wikipedia articles to return. The skill's parameter schema allows 1 to 5. More results cover more ground, and make longer responses. Fred uses 2. |
| `no_results_message` | A generic "couldn't find" message | What the function returns when no article matches. `{query}` is replaced with the search term. Write it in the agent's voice, because the model relays it to the caller. |
| `swaig_fields` | None | Extra settings for the function the skill registers. `fillers` are phrases the platform says while the search runs, by language code. |

The skill searches English Wikipedia, `en.wikipedia.org`, and has no option for another language.

### Example Configurations

Different agents need different settings. This example gives three agents three configurations:

```typescript
import { AgentBase, WikipediaSearchSkill } from '@signalwire/sdk';

// Minimal configuration
const minimal = new AgentBase({ name: 'minimal', route: '/minimal' });
await minimal.addSkill(new WikipediaSearchSkill());

// Academic assistant
const academic = new AgentBase({ name: 'academic', route: '/academic' });
await academic.addSkill(
  new WikipediaSearchSkill({
    num_results: 3,
    no_results_message:
      "No Wikipedia entries found for '{query}'. Check the spelling or try related terms.",
  }),
);

// Casual helper
const casual = new AgentBase({ name: 'casual', route: '/casual' });
await casual.addSkill(
  new WikipediaSearchSkill({
    num_results: 1,
    no_results_message: "Hmm, Wikipedia doesn't have info on '{query}'. Got another topic?",
    swaig_fields: {
      fillers: { 'en-US': ['Let me check...', 'Looking that up...'] },
    },
  }),
);
```

## How Skills Work Internally

`addSkill()` does three things when it runs.

### What Happens When You Add a Skill

1. **Checks.** The agent's skill manager refuses a second copy of a skill that allows only one. It also checks the environment variables and packages the skill needs, and `wikipedia_search` needs none.

2. **Setup.** It awaits the skill's `setup()` method. The Wikipedia skill reads `num_results` and `no_results_message` there. A skill whose `setup()` returns `false` isn't added, and `addSkill()` rejects.

3. **Registration.** The agent registers what the skill contributes: its functions, its prompt sections, its hints and its global data. This is the function definition in the skill's own code, `src/skills/builtin/wikipedia_search.ts`:

   <!-- copy of: src/skills/builtin/wikipedia_search.ts (excerpt) --> <!-- snippet: no-compile an excerpt from the skill's getTools() method in the SDK source -->
   ```typescript
   defineSkillTool({
     name: 'search_wiki',
     description: 'Search Wikipedia for information about a topic and get article summaries',
     parameters: {
       query: {
         type: 'string',
         description: 'The search term or topic to look up on Wikipedia.',
       },
     },
   ```

The skill also adds a "Wikipedia Search" section to the prompt, which tells the model when to use the function and how many summaries it returns.

### The search_wiki Function

After adding the skill, Fred has a `search_wiki` function. It takes one string argument and returns text:

```text
search_wiki(query: string): string
```

When the model calls it, the function:

1. Searches Wikipedia for articles that match the query
2. Retrieves the introduction of each article
3. Returns the introductions as text, separated by a line of `=` characters

The model calls it with the caller's topic as the `query` argument, for example `{ "query": "Marie Curie" }`.

## Testing Wikipedia Search

A few lines at the end of `fred.ts` can confirm the skill loaded, without starting a server.

### Step 3: Update the Test Lines

Replace the test lines from Lesson 3 with these. `createFred` is `async`, so they `await` it:

<!-- snippet: no-compile continues fred.ts, whose createFred function it uses -->
```typescript
// Build Fred and list what the skill added
const fred = await createFred();
console.log(`Fred's skills: ${fred.listSkills().map((skill) => skill.name).join(', ')}`);
console.log(`Fred's tools: ${fred.getTools().map((tool) => tool.name).join(', ')}`);
```

`listSkills()` returns the loaded skills, and `getTools()` returns the functions the agent registered. Run the file:

```bash
npx tsx fred.ts
```

After the same two warnings as in Lesson 3, the output lists the skill and the function it added:

```text
Fred's skills: wikipedia_search
Fred's tools: search_wiki
```

## How Fred Uses Wikipedia Search

When a caller asks about a topic, five things happen:

1. **The caller says:** "Who was Marie Curie?"
2. **The model decides** the question needs Wikipedia
3. **The model calls** `search_wiki` with `{ "query": "Marie Curie" }`
4. **The skill returns** the article introductions
5. **The model answers** the caller, in Fred's voice

### Example Conversation Flow

This exchange is from a text chat with the finished Fred, shortened to two turns. On a phone call, the platform also says one of the fillers while the search runs.

```text
Caller: Hi there!
Fred:   Hi there! I'm Fred, your friendly Wikipedia explorer. What fascinating fact or topic would you like to learn about today?

Caller: Who was Marie Curie, and what year did she win her second Nobel Prize?
        [Fred calls search_wiki with {"query":"Marie Curie"}]
Fred:   Marie Curie was a remarkable physicist and chemist who made groundbreaking discoveries in radioactivity. She won her second Nobel Prize in Chemistry in 1911, for the discovery of the elements radium and polonium, and for her studies on their nature and compounds. Would you like to learn more about her scientific achievements or her life story?
```

The answer comes from the article's introduction, which says she won the 1911 Nobel Prize in Chemistry.

## Skill Benefits

A skill saves you from writing and maintaining the integration yourself.

### Why Use Skills Instead of Custom Code?

With the skill, Wikipedia search is one call:

<!-- snippet: no-compile fragment: `fred` is the agent createFred builds -->
```typescript
await fred.addSkill(new WikipediaSearchSkill());
```

Without it, you'd write every part yourself:

```typescript
// You'd need to:
// 1. Choose a Wikipedia API
// 2. Make the API calls
// 3. Parse the responses
// 4. Format the results
// 5. Handle errors
// 6. Register a SWAIG function
// 7. Write its handler
```

### What Skills Provide

Using a skill gives you:

1. **Tested functionality**: built and tested with the SDK
2. **A consistent interface**: every skill is configured the same way
3. **Error handling**: failures return a message instead of crashing the call
4. **Documentation**: the [Skills System Guide](../../../docs/skills-guide.md) covers each built-in skill
5. **Maintenance**: fixes arrive with SDK updates

## Next Steps

Fred can search Wikipedia. Next, add a function of your own that shares facts about Wikipedia. Continue with [Lesson 5: Creating Custom Functions](05-custom-functions.md).

---

[Previous: Basic Agent](03-basic-agent.md) | [Overview](README.md) | [Next: Custom Functions](05-custom-functions.md)
