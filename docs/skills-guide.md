# Skills System Guide

Skills add a capability to an agent in one call: SWAIG tools, prompt sections, speech recognition hints and global data, packaged together. This guide covers adding skills to an agent, the built-in skills and their parameters, and writing your own skill.

The examples on this page assume this shared context:

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module so top-level `await` is allowed
declare global {
  // Shared context the fragments on this page assume.
  const agent: import('@signalwire/sdk').AgentBase;
  const SkillBase: typeof import('@signalwire/sdk').SkillBase;
  const SkillRegistry: typeof import('@signalwire/sdk').SkillRegistry;
  const registerBuiltinSkills: typeof import('@signalwire/sdk').registerBuiltinSkills;
  const registry: import('@signalwire/sdk').SkillRegistry;
  // Illustrative custom skill class referenced by the registry examples.
  const MyCustomSkill: typeof import('@signalwire/sdk').SkillBase;
}
```

---

## Table of Contents

1. [Overview](#overview)
2. [Using Skills](#using-skills)
3. [Built-in Skills](#built-in-skills)
4. [Skill Configuration](#skill-configuration)
5. [Skill Registry](#skill-registry)
6. [Creating Custom Skills](#creating-custom-skills)
7. [Skill Lifecycle](#skill-lifecycle)
8. [Environment Validation](#environment-validation)
9. [Environment Variables Reference](#environment-variables-reference)

---

## Overview

A skill is a class that extends `SkillBase`. When you add one to an agent, the agent registers everything the skill contributes. Three classes make up the system:

| Class | Role | Location |
|---|---|---|
| `SkillBase` | Abstract base class that every skill extends | `src/skills/SkillBase.ts` |
| `SkillManager` | Loads, validates and removes the skills attached to one agent | `src/skills/SkillManager.ts` |
| `SkillRegistry` | Process-wide singleton that maps skill names to skill classes | `src/skills/SkillRegistry.ts` |

A skill can contribute five kinds of things:

- **Tools**: SWAIG function definitions (name, description, parameters, handler) registered on the agent.
- **Prompt sections**: text added to the agent's prompt that tells the model when to use the tools.
- **Hints**: speech recognition hints for words the skill's callers are likely to say.
- **Global data**: keys merged into the agent's global data.
- **Metadata**: the skill's name, version, required environment variables and packages, and parameter schema.

For how the classes fit together, see the [Skills System Reference](skills-system.md).

---

## Using Skills

### `agent.addSkill()`

`addSkill()` takes a skill instance and returns a promise, because a skill's `setup()` can do asynchronous work. This example adds two built-in skills:

<!-- snippet: no-run the `web_search` skill needs Google credentials at setup, so the add fails without them -->
```typescript
import { AgentBase, DateTimeSkill, WebSearchSkill } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'my-agent' });

await agent.addSkill(new DateTimeSkill());
await agent.addSkill(new WebSearchSkill({ num_results: 3 }));
```

When you call `addSkill()`, the agent's `SkillManager` checks the skill, then the agent registers what it contributes:

1. A skill that doesn't support multiple instances and is already loaded is refused with an error.
2. Every variable in the skill's `REQUIRED_ENV_VARS` must be set. A missing one rejects the call with an error, and the skill isn't added.
3. The skill's parameter schema must be a non-empty object, and every package in `REQUIRED_PACKAGES` must import.
4. `setup()` runs. If it returns `false`, the call rejects with `Failed to setup skill '<name>'`, and the skill isn't added.
5. The agent registers the tools from `getTools()` and `getDataMapTools()`, the prompt sections from `getPromptSections()`, the hints from `getHints()` and the global data from `getGlobalData()`.

Because a failed check rejects the promise, wrap `addSkill()` in `try`/`catch` when the skill's configuration comes from outside your code.

### `agent.addSkillByName()`

`addSkillByName()` looks the name up in the global `SkillRegistry`, constructs the skill with the parameters you pass, and adds it. The registry starts empty, so call `registerBuiltinSkills()` once before you add a built-in skill by name:

```typescript
import { AgentBase, registerBuiltinSkills } from '@signalwire/sdk';

registerBuiltinSkills();

const agent = new AgentBase({ name: 'my-agent' });
await agent.addSkillByName('datetime');
await agent.addSkillByName('math');
```

Without `registerBuiltinSkills()`, the call rejects with `Failed to load skill 'datetime': skill not found in registry`. The name parameter accepts any string, and an editor suggests the built-in names. A misspelled name still compiles, and fails when the call runs.

### `agent.removeSkill()` and `agent.removeSkillByName()`

`removeSkill()` takes a skill's instance key or its `instanceId`, calls the skill's `cleanup()`, and removes it. It resolves to `true` when it found the skill:

```typescript
const removed = await agent.removeSkill('datetime');
```

A single-instance skill's instance key is its skill name, as in the example. `removeSkillByName('datetime')` removes the first loaded skill with that name.

### `agent.listSkills()`

`listSkills()` returns the name, `instanceId` and initialization state of every loaded skill:

```typescript
for (const skill of agent.listSkills()) {
  console.log(`${skill.name} (${skill.instanceId}) initialized: ${skill.initialized}`);
}
```

An `instanceId` combines the skill name, a timestamp and random bytes, for example `datetime-muluil2c-65ea4f3c`.

### `agent.hasSkill()`

`hasSkill()` reports whether any loaded skill has the given name:

```typescript
if (agent.hasSkill('web_search')) {
  console.log('Web search is available');
}
```

---

## Built-in Skills

The SDK ships the skills in the following table, in `src/skills/builtin/`. `custom_skills` and `ask_claude` exist only in the TypeScript SDK. The "Needs" column lists what must be in place before the skill loads.

| Skill name | Class | Tools (default names) | Needs |
|---|---|---|---|
| `datetime` | `DateTimeSkill` | `get_current_time`, `get_current_date` | Nothing |
| `math` | `MathSkill` | `calculate` | Nothing |
| `joke` | `JokeSkill` | `get_joke` | Nothing |
| `weather_api` | `WeatherApiSkill` | `get_weather` | An OpenWeatherMap key in `api_key` or `WEATHER_API_KEY` |
| `play_background_file` | `PlayBackgroundFileSkill` | `play_background_file` | A non-empty `files` list |
| `swml_transfer` | `SwmlTransferSkill` | `transfer_call`, plus `list_transfer_destinations` with `patterns` | `transfers` or `patterns` |
| `api_ninjas_trivia` | `ApiNinjasTriviaSkill` | `get_trivia` | An API Ninjas key, checked when the tool runs |
| `info_gatherer` | `InfoGathererSkill` | `start_questions`, `submit_answer` | A non-empty `questions` list |
| `custom_skills` | `CustomSkillsSkill` | One per entry in `tools` | `SWML_ALLOW_CUSTOM_HANDLER_CODE=true` for the handlers to run |
| `web_search` | `WebSearchSkill` | `web_search` | Google Custom Search credentials, and the `cheerio` package |
| `wikipedia_search` | `WikipediaSearchSkill` | `search_wiki` | Nothing |
| `google_maps` | `GoogleMapsSkill` | `lookup_address`, `compute_route` | A Google Maps key in `api_key` or `GOOGLE_MAPS_API_KEY` |
| `datasphere` | `DataSphereSkill` | `search_knowledge` | SignalWire credentials and a `document_id` |
| `datasphere_serverless` | `DataSphereServerlessSkill` | `search_knowledge` (DataMap) | `space_name`, `project_id`, `token` and `document_id` |
| `native_vector_search` | `NativeVectorSearchSkill` | `search_knowledge` | `documents` or a reachable `remote_url` |
| `spider` | `SpiderSkill` | `scrape_url`, `crawl_site`, `extract_structured_data` | The `cheerio` package |
| `claude_skills` | `ClaudeSkillsSkill` | One per SKILL.md file, prefixed `claude_` | A `skills_path` directory |
| `ask_claude` | `AskClaudeSkill` | `ask_claude` | An Anthropic key in `api_key` or `ANTHROPIC_API_KEY` |
| `mcp_gateway` | `McpGatewaySkill` | One per gateway tool, prefixed `mcp_`, plus `_mcp_gateway_hangup` | A reachable `gateway_url` and credentials. `allow_insecure_tls` also needs the `undici` package |

Every skill also accepts the two base parameters `swaig_fields` and `skip_prompt`, described in [Skill Configuration](#skill-configuration). The parameter tables in the following sections leave those two out. They list each parameter as the skill's `getParameterSchema()` declares it; where the code behaves differently, the text says so.

A tool's result is text the model reads, not speech. The model decides what to say to the caller.

### datetime

`DateTimeSkill` returns the current time or date in an IANA time zone, using `Intl.DateTimeFormat`. Both tools take an optional `timezone` argument and use UTC when it's absent. An unknown time zone returns a message that asks for a valid IANA identifier. The skill has no parameters of its own. This example adds it:

```typescript
import { DateTimeSkill } from '@signalwire/sdk';
await agent.addSkill(new DateTimeSkill());
```

`get_current_time` returns text such as `The current time is 10:55:42 PM UTC`, and `get_current_date` returns text such as `Today's date is Monday, September 28, 2026`.

### math

`MathSkill` evaluates an arithmetic expression with the `calculate` tool. It first checks that the expression contains only digits, the operators `+ - * / ^ %`, parentheses, decimal points and spaces. It then evaluates it as a JavaScript expression, with `^` as exponentiation. A result that isn't a finite number returns an error message. The skill has no parameters of its own. This example adds it:

```typescript
import { MathSkill } from '@signalwire/sdk';
await agent.addSkill(new MathSkill());
```

### joke

`JokeSkill` serves jokes from a small collection built into the SDK, so it needs no API key. The tool's required `type` argument is `jokes` or `dadjokes`. The result is an instruction to the model, for example `Tell this joke to the user: What did the ocean say to the beach? ... Nothing, it just waved.`

| Parameter | Type | Default | Required | Description |
|---|---|---|---|---|
| `tool_name` | string | `"get_joke"` | No | Name of the joke tool |

This example adds the skill with its default tool name:

```typescript
import { JokeSkill } from '@signalwire/sdk';
await agent.addSkill(new JokeSkill());
```

### weather_api

`WeatherApiSkill` gets current conditions from the OpenWeatherMap current-weather API (`api.openweathermap.org`). A WeatherAPI.com key doesn't work with it. The tool takes a `location` (a city, optionally with a country code, such as `Paris,FR`) and returns the conditions, temperature, humidity, wind and pressure. It's a webhook tool that runs in your agent, not a DataMap tool.

The key comes from `api_key`, or from `WEATHER_API_KEY` when `api_key` isn't set. Setup fails when neither is set.

| Parameter | Type | Default | Required | Description |
|---|---|---|---|---|
| `api_key` | string | none | Yes | OpenWeatherMap API key. Falls back to `WEATHER_API_KEY`. |
| `tool_name` | string | `"get_weather"` | No | Name of the weather tool |
| `units` | string | `"fahrenheit"` | No | `metric`, `imperial` or `standard` (Kelvin). `celsius` means `metric`, and `fahrenheit` means `imperial`. |

When you leave `units` out, the skill reports Fahrenheit. This example reports Celsius:

<!-- snippet: no-run needs an OpenWeatherMap key in WEATHER_API_KEY to load -->
```typescript
import { WeatherApiSkill } from '@signalwire/sdk';
await agent.addSkill(new WeatherApiSkill({ units: 'metric' }));
```

### play_background_file

`PlayBackgroundFileSkill` plays and stops pre-configured audio or video files in the background of a call. It registers one tool whose required `action` argument is `start_<key>` for each file, or `stop`. The tool's result carries a `play_background_file` or `stop_background_file` action, and tells the model what to say about it. Setup fails when `files` has no valid entry.

| Parameter | Type | Default | Required | Description |
|---|---|---|---|---|
| `tool_name` | string | `"play_background_file"` | No | Name of the tool. A different name lets you add a second instance. |
| `files` | array | none | Yes | Entries with `key`, `description` and `url` (all required), and `wait` (boolean, default `false`) |

This example configures one hold-music file:

```typescript
import { PlayBackgroundFileSkill } from '@signalwire/sdk';
await agent.addSkill(
  new PlayBackgroundFileSkill({
    files: [{ key: 'hold', description: 'Hold music', url: 'https://example.com/hold-music.mp3' }],
  }),
);
```

### swml_transfer

`SwmlTransferSkill` transfers the call to a destination the model picks. It accepts two configuration shapes, and setup fails when neither is present:

- `transfers` maps a pattern to a destination. A key such as `/sales/i` is a regular expression, case-insensitive with the `i` flag. Each value has a `url` (a SWML transfer) or an `address` (a connect), but not both.
- `patterns` is a list of named destinations: `{ name, destination, description?, message?, returnMessage?, postProcess?, final?, fromAddr? }`. A destination that starts with `http://` or `https://` becomes a SWML transfer, and anything else becomes a connect.

The tool takes the destination in the argument named by `parameter_name`. It tries the `transfers` patterns first, then the `patterns` names, which must match exactly, ignoring case. With `patterns`, the skill also registers `list_transfer_destinations`.

| Parameter | Type | Default | Required | Description |
|---|---|---|---|---|
| `tool_name` | string | `"transfer_call"` | No | Name of the transfer tool |
| `transfers` | object | none | Yes | Pattern-to-destination map. Each value takes `url` or `address`, and optional `message`, `return_message`, `post_process`, `final` and `from_addr`. |
| `patterns` | array | none | No | Named destinations, as described earlier |
| `allow_arbitrary` | boolean | none | No | Lets the model transfer to a destination that matches nothing |
| `description` | string | `"Transfer call based on pattern matching"` | No | Description of the transfer tool |
| `parameter_name` | string | `"transfer_type"` | No | Name of the tool's destination argument |
| `parameter_description` | string | `"The type of transfer to perform"` | No | Description of that argument |
| `default_message` | string | `"Please specify a valid transfer type."` | No | Result when the destination matches nothing |
| `default_post_process` | boolean | `false` | No | Whether the no-match result is post-processed |
| `required_fields` | object | `{}` | No | Extra arguments the model must collect (name to description). They're saved under `call_data` in global data. |

The schema marks `transfers` required, but `patterns` alone also works. When you leave `allow_arbitrary` unset, it's on only if both `transfers` and `patterns` are empty. With it on, the model can transfer the caller to any number or SIP address it chooses, so leave it off unless you want that.

This example routes two departments by name:

```typescript
import { SwmlTransferSkill } from '@signalwire/sdk';
await agent.addSkill(
  new SwmlTransferSkill({
    patterns: [
      { name: 'billing', destination: '+15551234567', description: 'Billing department' },
      { name: 'support', destination: 'sip:support@example.com', description: 'Technical support' },
    ],
  }),
);
```

### api_ninjas_trivia

`ApiNinjasTriviaSkill` fetches a trivia question from the API Ninjas trivia API. The key comes from `api_key` or `API_NINJAS_KEY`, and it's checked when the tool runs, not when the skill loads. By default the result gives the model the answer with an instruction not to reveal it until the caller tries.

| Parameter | Type | Default | Required | Description |
|---|---|---|---|---|
| `tool_name` | string | `"get_trivia"` | No | Name of the trivia tool |
| `api_key` | string | none | Yes | API Ninjas key. Falls back to `API_NINJAS_KEY`. |
| `categories` | array | All 14 categories | No | Categories the tool offers, from `artliterature`, `language`, `sciencenature`, `general`, `fooddrink`, `peopleplaces`, `geography`, `historyholidays`, `entertainment`, `toysgames`, `music`, `mathematics`, `religionmythology` and `sportsleisure` |
| `default_category` | string | none | No | Category used when the model sends none |
| `reveal_answer` | boolean | `false` | No | Include the answer in the result as plain text |

This example limits the tool to two categories:

```typescript
import { ApiNinjasTriviaSkill } from '@signalwire/sdk';
await agent.addSkill(
  new ApiNinjasTriviaSkill({ categories: ['sciencenature', 'geography'] }),
);
```

### info_gatherer

`InfoGathererSkill` asks a list of questions in order and stores the answers. `start_questions` returns the first question, and each `submit_answer` call stores an answer and returns the next question. The state lives in global data under `skill:<prefix>`, or `skill:info_gatherer` without a prefix, as `{ questions, question_index, answers }`. After the last answer, the result returns `completion_message` and turns both tools off.

A question with `confirm: true` refuses an answer until the model calls `submit_answer` again with `confirmed_by_user: true`. The result instructs the model to read the answer back first. Setup fails when `questions` is missing, empty, or has an entry without `key_name` or `question_text`.

| Parameter | Type | Default | Required | Description |
|---|---|---|---|---|
| `tool_name` | string | `"info_gatherer"` | No | Listed in the schema. The tool names come from `prefix`. |
| `questions` | array | none | Yes | Entries with `key_name`, `question_text`, and optional `confirm` (boolean) and `prompt_add` (extra instruction text) |
| `prefix` | string | none | No | Names the tools `<prefix>_start_questions` and `<prefix>_submit_answer`, and the state key `skill:<prefix>`. Use it to add a second instance. |
| `completion_message` | string | `"Thank you! All questions have been answered. ..."` | No | Result returned after the last answer |

This example asks three questions and confirms the email address:

```typescript
import { InfoGathererSkill } from '@signalwire/sdk';
await agent.addSkill(
  new InfoGathererSkill({
    questions: [
      { key_name: 'full_name', question_text: 'What is your full name?' },
      { key_name: 'email', question_text: 'What is your email address?', confirm: true },
      { key_name: 'reason', question_text: 'How can I help you today?' },
    ],
  }),
);
```

### custom_skills

`CustomSkillsSkill` registers tools from configuration, with each handler written as a JavaScript function body in `handler_code`. The body receives `args`, `rawData` and `FunctionResult`, and returns a `FunctionResult`, a string or a plain object.

The skill compiles each body with the `Function` constructor, only when `SWML_ALLOW_CUSTOM_HANDLER_CODE` is `true`. The compiled code runs in your Node.js process with its full permissions: it isn't sandboxed. Without the variable, the tools are still registered, and each one returns an error message. Enable the variable only when the handler code comes from you, never from a caller, a model or an untrusted file.

| Parameter | Type | Default | Required | Description |
|---|---|---|---|---|
| `tools` | array | none | No | Entries with `name`, `description` and `handler_code`, and optional `parameters`, `required`, `prompt_description`, `secure` and `fillers` |
| `prompt_title` | string | `"Custom Tools"` | No | Title of the prompt section that lists the tools |
| `prompt_body` | string | none | No | Body of that prompt section |

Each `parameters` entry is `{ name, type, description }`, with an optional `required: true`. An argument is required when its entry sets `required: true` or the tool's `required` array lists its name. This example defines one tool:

```typescript
import { CustomSkillsSkill } from '@signalwire/sdk';
await agent.addSkill(
  new CustomSkillsSkill({
    prompt_title: 'Greeting Tools',
    tools: [
      {
        name: 'get_greeting',
        description: 'Get a personalized greeting for a customer.',
        parameters: [{ name: 'name', type: 'string', description: 'Customer name' }],
        required: ['name'],
        handler_code: 'return new FunctionResult(`Hello, ${args.name}! Welcome back.`);',
      },
    ],
  }),
);
```

### web_search

`WebSearchSkill` searches with the Google Custom Search JSON API, then fetches the result pages and returns the text of the best ones. It requests `num_results` times `oversample_factor` results (at most 10), scores each page for length, relevance and boilerplate, and keeps one page per domain. When no page scores `min_quality_score` or more, or `overall_deadline` passes, it returns the search snippets instead.

The credentials come from `api_key` and `search_engine_id`, or from `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID` (`GOOGLE_SEARCH_CX` also works for the engine ID). Setup fails when either is missing, and the skill needs the optional `cheerio` package.

The skill fetches pages that search results point to, so it refuses private and internal addresses. It checks each URL and every redirect, and connects only to an address it checked. `SWML_ALLOW_PRIVATE_URLS` turns these checks off. For the proxy option, see [Configuration](configuration.md).

| Parameter | Type | Default | Required | Description |
|---|---|---|---|---|
| `tool_name` | string | none | No | Name of the search tool. The code uses `web_search` when it's unset. |
| `api_key` | string | none | Yes | Google Custom Search API key. Falls back to `GOOGLE_SEARCH_API_KEY`. |
| `search_engine_id` | string | none | Yes | Search engine ID. Falls back to `GOOGLE_SEARCH_ENGINE_ID`. |
| `num_results` | integer | `3` | No | Results to return, from 1 to 10 |
| `delay` | number | `0.5` | No | Seconds between page fetches when `parallel_scrape` is `false` |
| `max_content_length` | integer | `32768` | No | Maximum characters in the result, at least 1000 |
| `oversample_factor` | number | `2.5` | No | Multiplier for how many results to fetch, from 1 to 3.5 |
| `min_quality_score` | number | `0.3` | No | Lowest page score kept, from 0 to 1 |
| `no_results_message` | string | `"I couldn't find quality results for '{query}'. ..."` | No | Result when nothing is found. `{query}` is replaced with the query. |
| `per_page_timeout` | number | `2` | No | Seconds to wait for one page |
| `overall_deadline` | number | `10` | No | Seconds for the whole tool call |
| `parallel_scrape` | boolean | `true` | No | Fetch the pages at the same time instead of one after another |
| `snippets_only` | boolean | `false` | No | Return the search snippets without fetching pages |
| `response_prefix` | string | `""` | No | Text added before every non-empty result |
| `response_postfix` | string | `""` | No | Text added after every non-empty result |
| `safe_search` | string | `"medium"` | No | `off`, `medium` or `high`. Any value except `off` is sent as the `safe` parameter. |

This example returns five results and reads the credentials from the environment:

<!-- snippet: no-run needs Google Custom Search credentials, and fetches pages -->
```typescript
import { WebSearchSkill } from '@signalwire/sdk';
await agent.addSkill(new WebSearchSkill({ num_results: 5, safe_search: 'high' }));
```

### wikipedia_search

`WikipediaSearchSkill` searches English Wikipedia (`en.wikipedia.org`) with the MediaWiki Action API and returns the introduction of each matching article. It needs no key.

| Parameter | Type | Default | Required | Description |
|---|---|---|---|---|
| `num_results` | integer | `1` | No | Articles to return, from 1 to 5 |
| `no_results_message` | string | `"I couldn't find any Wikipedia articles for '{query}'. ..."` | No | Result when nothing is found. `{query}` is replaced with the query. |

This example returns up to three articles:

```typescript
import { WikipediaSearchSkill } from '@signalwire/sdk';
await agent.addSkill(new WikipediaSearchSkill({ num_results: 3 }));
```

### google_maps

`GoogleMapsSkill` registers two tools. `lookup_address` geocodes an address or business name with the Geocoding API, optionally biased toward a latitude and longitude. `compute_route` gets the driving distance and time between two coordinates from the Routes API.

The key comes from `api_key`, or from `GOOGLE_MAPS_API_KEY` when `api_key` isn't set. Setup fails when neither is set.

| Parameter | Type | Default | Required | Description |
|---|---|---|---|---|
| `api_key` | string | none | Yes | Google Maps API key. Falls back to `GOOGLE_MAPS_API_KEY`. |
| `lookup_tool_name` | string | `"lookup_address"` | No | Name of the geocoding tool |
| `route_tool_name` | string | `"compute_route"` | No | Name of the route tool |

This example adds the skill with its default tool names:

<!-- snippet: no-run needs a Google Maps key in GOOGLE_MAPS_API_KEY to load -->
```typescript
import { GoogleMapsSkill } from '@signalwire/sdk';
await agent.addSkill(new GoogleMapsSkill());
```

### datasphere

`DataSphereSkill` searches a SignalWire DataSphere document from your agent: its handler sends the query to your space's DataSphere search API. The space, project ID and token come from `space_name`, `project_id` and `token`, or from `SIGNALWIRE_SPACE`, `SIGNALWIRE_PROJECT_ID` and `SIGNALWIRE_API_TOKEN`. `document_id` has no fallback. Setup fails when any of the four is missing.

| Parameter | Type | Default | Required | Description |
|---|---|---|---|---|
| `tool_name` | string | `"search_knowledge"` | No | Name of the search tool. A different name lets you add a second instance. |
| `space_name` | string | none | Yes | Space name, such as `mycompany` for `mycompany.signalwire.com` |
| `project_id` | string | none | Yes | Project ID |
| `token` | string | none | Yes | API token |
| `document_id` | string | none | Yes | Document to search |
| `count` | integer | `1` | No | Results to return, from 1 to 10 |
| `distance` | number | `3` | No | Maximum distance for a result, from 0 to 10. Lower is more similar. |
| `tags` | array | none | No | Tags to filter results by |
| `language` | string | none | No | Language code for query expansion, such as `en` |
| `pos_to_expand` | array | none | No | Parts of speech to expand with synonyms: `NOUN`, `VERB`, `ADJ`, `ADV` |
| `max_synonyms` | integer | none | No | Most synonyms to use, from 1 to 10 |
| `no_results_message` | string | `"I couldn't find any relevant information for '{query}' ..."` | No | Result when nothing is found |

This example searches one document for up to three results:

<!-- snippet: no-run needs SignalWire credentials to load -->
```typescript
import { DataSphereSkill } from '@signalwire/sdk';
await agent.addSkill(new DataSphereSkill({ document_id: 'my-doc-id', count: 3 }));
```

### datasphere_serverless

`DataSphereServerlessSkill` runs the same search as a DataMap tool. The SWML carries the request and SignalWire makes it, so the search doesn't call back to your agent. It takes the same parameters as `datasphere`, but reads `space_name`, `project_id`, `token` and `document_id` only from its configuration. Setup fails when any of them is missing.

The skill writes the DataSphere URL and a Basic authorization header built from `project_id` and `token` into the SWML. Anyone who can read the agent's SWML can decode that header, so keep the agent's basic auth credentials private. The generated webhook reads the response from the root of the template data. For the template rules, see the [DataMap Guide](datamap-guide.md).

This is the `data_map` block the skill renders for `count: 2`, from a real run, with the placeholder credentials `p` and `t`:

```json
{
  "webhooks": [
    {
      "url": "https://demo.signalwire.com/api/datasphere/documents/search",
      "method": "POST",
      "headers": { "Content-Type": "application/json", "Authorization": "Basic cDp0" },
      "params": { "document_id": "doc1", "query_string": "${args.query}", "count": 2, "distance": 3 },
      "foreach": {
        "input_key": "chunks",
        "output_key": "formatted_results",
        "max": 2,
        "append": "=== RESULT ===\n${this.text}\n==================================================\n\n"
      },
      "output": { "response": "I found results for \"${input.args.query}\":\n\n${formatted_results}" },
      "error_keys": ["error"]
    }
  ],
  "output": {
    "response": "I couldn't find any relevant information for '${args.query}' in the knowledge base. Try rephrasing your question or asking about a different topic."
  }
}
```

`foreach` walks the `chunks` array of the response, appends each chunk's `text` (`${this.text}`) to `formatted_results`, and the output uses the result. The top-level `output` is the result when the webhook fails or returns an `error` key. This example adds the skill:

```typescript
import { DataSphereServerlessSkill } from '@signalwire/sdk';
await agent.addSkill(
  new DataSphereServerlessSkill({
    space_name: 'mycompany',
    project_id: process.env['SIGNALWIRE_PROJECT_ID'],
    token: process.env['SIGNALWIRE_API_TOKEN'],
    document_id: 'my-doc-id',
  }),
);
```

### native_vector_search

`NativeVectorSearchSkill` searches documents in one of two modes. With `documents`, it indexes them in memory when it loads and ranks them by TF-IDF blended with keyword overlap. With `remote_url`, it sends each query to a search server that speaks the Python SDK's `sw-search` protocol, and the server ranks the results.

The tool takes a required `query` and an optional `count`. A `remote_url` must not resolve to a private or internal address unless `SWML_ALLOW_PRIVATE_URLS` is set, and its `/health` must answer 200 at setup. Every request to it is checked the same way, including each redirect, and connects only to an address it checked. Credentials in the URL (`http://user:pass@host`) are sent as basic auth. In memory mode, setup succeeds with no documents, and the tool then returns a message saying nothing is loaded.

The schema also lists the Python skill's local-index parameters. This SDK accepts and ignores these: `index_file` (used only to tell instances apart), `build_index`, `source_dir`, `file_types`, `exclude_patterns`, `backend`, `connection_string`, `collection_name`, `overwrite`, `nlp_backend`, `query_nlp_backend`, `index_nlp_backend` and `model_name`. The parameters that take effect are these:

| Parameter | Type | Default | Required | Description |
|---|---|---|---|---|
| `tool_name` | string | `"search_knowledge"` | No | Name of the search tool. A different name lets you add a second instance. |
| `documents` | array | none | No | Documents to index in memory: `{ id, text, metadata?, tags? }` |
| `remote_url` | string | none | No | Base URL of a remote search server |
| `index_name` | string | `"default"` | No | Index to query on the remote server |
| `count` | integer | `5` | No | Default number of results, from 1 to 20 |
| `similarity_threshold` | number | `0` | No | Lowest score returned, from 0 to 1 |
| `tags` | array | `[]` | No | Return only documents with one of these tags |
| `global_tags` | array | `[]` | No | Tags added to every in-memory document |
| `keyword_weight` | number | none | No | In memory mode, the share of the score that keyword overlap contributes, from 0 to 1. Unset means 0.3. With `remote_url` it has no effect, and setting it logs a warning. |
| `no_results_message` | string | `"No information found for '{query}'"` | No | Result when nothing is found |
| `response_prefix` | string | `""` | No | Text added before the results |
| `response_postfix` | string | `""` | No | Text added after the results |
| `max_content_length` | integer | `32768` | No | Maximum characters in the result, shared by the results |
| `response_format_callback` | object | none | No | A function that receives the formatted response and the results, and returns the text to use |
| `description` | string | `"Search the knowledge base for information"` | No | Description of the search tool |
| `hints` | array | `[]` | No | Extra speech recognition hints |
| `verbose` | boolean | `false` | No | Log index details at setup |

This example indexes two documents in memory:

```typescript
import { NativeVectorSearchSkill } from '@signalwire/sdk';
await agent.addSkill(
  new NativeVectorSearchSkill({
    documents: [
      { id: 'faq-1', text: 'Reset your password in Settings.' },
      { id: 'faq-2', text: 'Business hours are 9 to 5.' },
    ],
  }),
);
```

With that configuration and `keyword_weight: 0.5`, a `search_knowledge` call with the query `password reset` returned this result:

```text
Found 1 relevant results for 'password reset':

**Result 1** (from faq-1, relevance: 0.83)
Reset your password in Settings.
```

### spider

`SpiderSkill` fetches web pages itself and extracts their content. It registers three tools, each taking only a URL: `scrape_url`, `crawl_site` (argument `start_url`) and `extract_structured_data`. With `tool_name` set, the tool names get that prefix, such as `docs_scrape_url`. It needs the optional `cheerio` package.

`crawl_site` follows links breadth first from the start page, up to `max_pages` pages and `max_depth` links deep. It stays on the start page's host, and follows only links that match a `follow_patterns` expression when you set any. `extract_structured_data` returns the text that each configured selector matches. A selector is CSS; one that starts with `/` is read as XPath, and only its first `//tag` step is used.

The skill refuses private and internal addresses. It checks each URL and each link it discovers, and checks every redirect. It connects only to an address it checked. `SWML_ALLOW_PRIVATE_URLS` turns these checks off. For the proxy option, see [Configuration](configuration.md).

With `follow_robots_txt: true`, it skips a page, or a redirect to a page, that the site's robots.txt disallows for `user_agent`. It keeps a site's rules for 24 hours. A robots.txt answered with 401 or 403 disallows the whole site, and any other 4xx allows it. When robots.txt can't be fetched, or answers with a server error, the page is skipped and the next request tries again.

| Parameter | Type | Default | Required | Description |
|---|---|---|---|---|
| `tool_name` | string | none | No | Prefix for the tool names. The tools keep their plain names when it's unset. |
| `delay` | number | `0.1` | No | Seconds between pages while crawling |
| `concurrent_requests` | integer | `5` | No | Deprecated, and has no effect: the spider fetches one page at a time. Setting it logs a warning. |
| `timeout` | integer | `5` | No | Seconds to wait for a request, from 1 to 60 |
| `max_pages` | integer | `1` | No | Most pages a crawl fetches, from 1 to 100 |
| `max_depth` | integer | `0` | No | How many links deep a crawl goes, from 0 to 5 |
| `extract_type` | string | `"fast_text"` | No | How `scrape_url` extracts content: `fast_text`, `markdown` or `structured` |
| `max_text_length` | integer | `3000` | No | Maximum characters per page, from 100 to 100000 |
| `clean_text` | boolean | `true` | No | Collapse extra whitespace |
| `selectors` | object | `{}` | No | Field name to selector, for `extract_structured_data` and for `scrape_url` with `structured` |
| `follow_patterns` | array | `[]` | No | Regular expressions a crawled link must match |
| `user_agent` | string | `"Spider/1.0 (SignalWire AI Agent)"` | No | User agent sent with every request, and matched against robots.txt |
| `headers` | object | `{}` | No | Extra headers sent with every request, to any URL the model asks for. A redirect to another origin drops `Authorization`, `Cookie` and `Proxy-Authorization`. |
| `follow_robots_txt` | boolean | `false` | No | Honor robots.txt, as described earlier |
| `cache_enabled` | boolean | `true` | No | Keep up to 100 fetched pages in memory |

An `extract_type` of `clean_text`, `full_text`, `html` or `custom` was never implemented. These values still load, work as `fast_text` and log a warning. Any other value outside the three listed makes setup fail.

This example returns pages as markdown and honors robots.txt:

```typescript
import { SpiderSkill } from '@signalwire/sdk';
await agent.addSkill(
  new SpiderSkill({ extract_type: 'markdown', max_text_length: 5000, follow_robots_txt: true }),
);
```

### claude_skills

`ClaudeSkillsSkill` reads Claude-style skill folders, each with a `SKILL.md` that has YAML front matter (`name`, `description`) and instructions. It registers one tool per skill, named `tool_prefix` plus the skill name. The tool returns the skill's instructions, or one of its other markdown files through the `section` argument, with the model's `arguments` substituted in.

A skill with `disable-model-invocation: true` gets no tool and no prompt entry. A skill with `user-invocable: false` gets a prompt entry and no tool. `ignore_invocation_control` registers both kinds anyway.

With `allow_shell_injection: true`, each `` !`command` `` in a skill's text runs as a shell command in the skill's folder. It runs every time the tool is called, and its output replaces the pattern. The commands come from the SKILL.md files and run with your process's permissions. The model's arguments are substituted after the commands run, so they don't reach the shell. Enable it only for skill folders you control.

| Parameter | Type | Default | Required | Description |
|---|---|---|---|---|
| `tool_name` | string | `"claude_skills"` | No | Tells instances apart |
| `skills_path` | string | none | Yes | Directory that holds the skill folders |
| `include` | array | `["*"]` | No | Glob patterns of skill names to load |
| `exclude` | array | `[]` | No | Glob patterns of skill names to skip |
| `prompt_title` | string | `"Claude Skills"` | No | Title of the prompt section |
| `prompt_intro` | string | `"You have access to specialized skills. ..."` | No | Opening text of the prompt section |
| `skill_descriptions` | object | `{}` | No | Skill name to a description that replaces the one in SKILL.md |
| `tool_prefix` | string | `"claude_"` | No | Prefix of the tool names. Use `""` for none. |
| `response_prefix` | string | `""` | No | Text added before each result |
| `response_postfix` | string | `""` | No | Text added after each result |
| `allow_shell_injection` | boolean | `false` | No | Run `` !`command` `` patterns, as described earlier |
| `allow_script_execution` | boolean | `false` | No | List the files in each skill's `scripts/` and `assets/` folders in the prompt. It runs nothing. |
| `ignore_invocation_control` | boolean | `false` | No | Ignore `disable-model-invocation` and `user-invocable` |
| `shell_timeout` | integer | `30` | No | Seconds a shell command may run |

This example loads every skill folder under one directory:

<!-- snippet: no-run needs a real directory of SKILL.md folders -->
```typescript
import { ClaudeSkillsSkill } from '@signalwire/sdk';
await agent.addSkill(new ClaudeSkillsSkill({ skills_path: '/path/to/skills' }));
```

### ask_claude

`AskClaudeSkill` sends a prompt to the Anthropic Messages API and returns the reply. The tool takes a required `prompt` and an optional `system_prompt`. The key comes from `api_key`, or from `ANTHROPIC_API_KEY` when `api_key` isn't set. Setup fails when neither is set.

| Parameter | Type | Default | Required | Description |
|---|---|---|---|---|
| `api_key` | string | none | Yes | Anthropic API key. Falls back to `ANTHROPIC_API_KEY`. |
| `model` | string | `"claude-sonnet-4-5-20250929"` | No | Model to call |
| `max_tokens` | number | `1024` | No | Maximum tokens in the reply |

This example sets the reply length:

<!-- snippet: no-run needs an Anthropic key in ANTHROPIC_API_KEY to load -->
```typescript
import { AskClaudeSkill } from '@signalwire/sdk';
await agent.addSkill(new AskClaudeSkill({ max_tokens: 512 }));
```

### mcp_gateway

`McpGatewaySkill` connects to an MCP gateway service and registers a SWAIG tool for each tool the gateway's services expose, named `<tool_prefix><service>_<tool>`. At setup it checks `gateway_url` against private and internal addresses, calls the gateway's `/health`, and lists the tools. Setup fails if any step fails. It also registers `_mcp_gateway_hangup`, marked `is_hangup_hook`, whose handler closes the call's MCP session.

Authentication is a bearer token (`auth_token` or `MCP_GATEWAY_AUTH_TOKEN`), or basic auth (`auth_user` and `auth_password`, or `MCP_GATEWAY_AUTH_USER` and `MCP_GATEWAY_AUTH_PASSWORD`). TLS verification stays on unless you set both `verify_ssl: false` and `allow_insecure_tls: true`. With both set, the skill accepts any certificate. For the gateway itself, see the [MCP Gateway Reference](mcp_gateway_reference.md).

| Parameter | Type | Default | Required | Description |
|---|---|---|---|---|
| `gateway_url` | string | none | Yes | Base URL of the gateway |
| `auth_token` | string | none | No | Bearer token. Falls back to `MCP_GATEWAY_AUTH_TOKEN`. |
| `auth_user` | string | none | No | Basic auth user, when there's no token. Falls back to `MCP_GATEWAY_AUTH_USER`. |
| `auth_password` | string | none | No | Basic auth password. Falls back to `MCP_GATEWAY_AUTH_PASSWORD`. |
| `services` | array | `[]` | No | `{ name, tools }` entries, where `tools` is `"*"` or a list of names. Empty means every service. |
| `session_timeout` | integer | `300` | No | Session timeout in seconds, sent to the gateway |
| `tool_prefix` | string | `"mcp_"` | No | Prefix of the registered tool names |
| `retry_attempts` | integer | `3` | No | Retries for a failed request |
| `request_timeout` | integer | `30` | No | Request timeout in seconds |
| `verify_ssl` | boolean | `true` | No | Set `false` together with `allow_insecure_tls` to skip certificate checks |
| `allow_insecure_tls` | boolean | `false` | No | Required as well as `verify_ssl: false` to skip certificate checks |

This example exposes every tool of one service:

<!-- snippet: no-run needs a reachable MCP gateway at setup -->
```typescript
import { McpGatewaySkill } from '@signalwire/sdk';
await agent.addSkill(
  new McpGatewaySkill({
    gateway_url: 'https://mcp-gateway.example.com',
    auth_token: process.env['MCP_GATEWAY_AUTH_TOKEN'],
    services: [{ name: 'todo', tools: '*' }],
  }),
);
```

---

## Skill Configuration

A skill takes its configuration as a plain object, typed `SkillConfig`:

```typescript
interface SkillConfig {
  [key: string]: unknown;
}
```

Two parameters apply to every skill:

- `swaig_fields` (object, default `{}`): fields copied into every tool definition the skill registers, such as `{ fillers: { 'en-US': ['One moment'] } }`. They override the same fields the tool sets.
- `skip_prompt` (boolean, default `false`): when `true`, the skill adds no prompt sections.

A `secure` key in `swaig_fields` sets whether the skill's tools need a per-call token, unless a tool sets `secure` itself.

A skill whose class sets `SUPPORTS_MULTIPLE_INSTANCES = true` also gets `tool_name` in its schema. This example adds a second DataSphere search under its own tool name:

<!-- snippet: no-run needs SignalWire credentials to load -->
```typescript
import { DataSphereSkill } from '@signalwire/sdk';
await agent.addSkill(new DataSphereSkill({ document_id: 'drinks-doc', tool_name: 'search_drinks' }));
await agent.addSkill(new DataSphereSkill({ document_id: 'food-doc', tool_name: 'search_food' }));
```

The schema describes the parameters for tools and user interfaces. The SDK doesn't check a configuration against it. A wrong type, an out-of-range value or a missing `required` parameter is caught only if the skill's `setup()` checks it. For the schema format, see [Skills Parameter Schema](skills_parameter_schema.md).

### Accessing Config in Skills

Inside a skill, `this.getConfig<T>(key, defaultValue)` reads a configuration value and returns `defaultValue` when the key is absent:

<!-- snippet: no-compile illustrative method-body fragment; `this` refers to a SkillBase subclass -->
```typescript
// Inside a skill class
const maxResults = this.getConfig<number>('max_results', 5);
const safeSearch = this.getConfig<string>('safe_search', 'medium');
```

`this.params` returns the whole configuration, read-only, without `swaig_fields`.

### Declaring Skill Metadata and Config Schema

A skill declares its metadata as static fields, and its parameters in the static `getParameterSchema()`. Spread the base schema so `swaig_fields` and `skip_prompt` stay in it:

```typescript
import { SkillBase, type ParameterSchemaEntry, type SkillToolDefinition } from '@signalwire/sdk';

export class MySkill extends SkillBase {
  static override SKILL_NAME = 'my_skill';
  static override SKILL_DESCRIPTION = 'Looks up order status.';
  static override SKILL_VERSION = '1.0.0';
  static override REQUIRED_ENV_VARS = ['MY_API_KEY'] as const;

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      max_results: {
        type: 'integer',
        description: 'Maximum number of results to return.',
        default: 5,
        required: false,
        min: 1,
        max: 10,
      },
    };
  }

  override getTools(): SkillToolDefinition[] {
    return [];
  }
}
```

---

## Skill Registry

The `SkillRegistry` is a process-wide singleton that maps skill names to skill classes. `addSkillByName()` and `SkillManager.loadSkillByName()` look names up in it.

### Getting the Registry

`getInstance()` returns the singleton:

```typescript
import { SkillRegistry } from '@signalwire/sdk';

const registry = SkillRegistry.getInstance();
```

### Registering Built-in Skills

`registerBuiltinSkills()` registers every built-in skill, then locks every name the registry holds at that moment:

```typescript
import { registerBuiltinSkills } from '@signalwire/sdk';

registerBuiltinSkills();
```

It skips a name that's already registered, so a second call changes nothing. After it runs, `register()` refuses to replace a locked name: it logs `Cannot overwrite locked skill` and keeps the original class. The lock stops a third-party or discovered skill from taking over a built-in name. It doesn't stop `unregister()` or `clear()`.

### Manual Registration

`register()` takes the skill class itself and files it under the class's static `SKILL_NAME`. It throws when `SKILL_NAME` is empty or `getParameterSchema()` doesn't return a non-empty object:

<!-- snippet: no-run illustrative fragment: references the assumed `registry` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
registry.register(MyCustomSkill);
```

To lock names yourself, call `registry.lock(['my_skill'])`, or `registry.lock()` to lock every registered name.

### Creating Instances by Name

`create()` constructs a registered skill with an optional configuration, and returns `null` for an unknown name:

<!-- snippet: no-run illustrative fragment: references the assumed `registry` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const skill = registry.create('datetime');
if (skill) {
  await agent.addSkill(skill);
}

const weatherSkill = registry.create('weather_api', { units: 'imperial' });
```

### Querying the Registry

These methods report what's registered:

<!-- snippet: no-run illustrative fragment: references the assumed `registry` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
registry.has('datetime'); // true once registered

const names = registry.listRegistered(); // ['datetime', 'math', ...]

// Name, description, version, supportsMultipleInstances, requiredEnvVars,
// requiredPackages and parameters for every registered skill
const withSchemas = registry.listSkills();

const schema = registry.getSkillSchema('web_search'); // one skill, or undefined
const all = registry.getAllSkillsSchema(); // keyed by skill name

const count = registry.size;
```

### Skill Discovery from Directories

The registry can import skill modules from directories and register the skill classes they export. Discovery runs the code in every module it imports, with your process's permissions. For that reason it's off unless `SWML_SKILL_DISCOVERY_ENABLED` is `true`. Without it, the discovery methods log a warning and return an empty list.

These calls add a search path and discover skills:

<!-- snippet: no-run illustrative fragment: references the assumed `registry` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
registry.addSearchPath('/path/to/my/skills');

// Import the modules in one directory and register their skill classes
const discovered = await registry.discoverFromDirectory('/path/to/my/skills');

// The same, for every search path
const allDiscovered = await registry.discoverAll();
```

In a directory, discovery imports every `.ts` and `.js` file except `.d.ts` files, and `skill.ts` in each subdirectory, or `skill.js` when there's no `skill.ts`. It registers every exported class that extends `SkillBase` and sets `SKILL_NAME`. A module that exports only a `createSkill` factory registers nothing. Nothing runs discovery for you: call `discoverFromDirectory()` or `discoverAll()`.

`SIGNALWIRE_SKILL_PATHS` adds colon-separated search paths when the registry is first created:

```bash
export SIGNALWIRE_SKILL_PATHS="/app/skills:/shared/skills"
```

Only point discovery at directories that you control, because anyone who can write a file there can run code in your agent.

### Cleanup

These calls remove registrations, mostly for tests:

<!-- snippet: no-run illustrative fragment: references the assumed `registry` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
registry.unregister('my_skill'); // one name, locked or not
registry.clear(); // every registration
SkillRegistry.resetInstance(); // drop the singleton
```

---

## Creating Custom Skills

To create a skill, extend `SkillBase`, set `SKILL_NAME` and `SKILL_DESCRIPTION`, and return tools from `getTools()`. The constructor throws when either static field is empty.

### Minimal Custom Skill

This skill registers one tool, and its style comes from the configuration:

```typescript
import { SkillBase, FunctionResult, type SkillToolDefinition } from '@signalwire/sdk';

export class GreetingSkill extends SkillBase {
  static override SKILL_NAME = 'greeting';
  static override SKILL_DESCRIPTION = 'Provides personalized greetings.';

  override getTools(): SkillToolDefinition[] {
    const style = this.getConfig<string>('style', 'formal');

    return [
      {
        name: 'greet_customer',
        description: 'Generate a personalized greeting for a customer.',
        parameters: {
          name: { type: 'string', description: 'The customer name.' },
        },
        required: ['name'],
        handler: (args: Record<string, unknown>) => {
          const name = String(args.name ?? '');
          if (style === 'casual') {
            return new FunctionResult(`Greet the customer casually by name: ${name}.`);
          }
          return new FunctionResult(`Greet the customer formally by name: ${name}.`);
        },
      },
    ];
  }
}
```

The handler's result is an instruction for the model, which decides what to say to the caller. To register the class for directory discovery, export it from the module. For discovery and packaging, see [Third-Party Skills](third_party_skills.md).

### Full-Featured Custom Skill

This skill uses every hook: a parameter schema, `setup()`, `cleanup()`, a secure tool with fillers, a prompt section, hints and global data:

```typescript
import {
  SkillBase,
  FunctionResult,
  type SkillToolDefinition,
  type SkillPromptSection,
  type ParameterSchemaEntry,
} from '@signalwire/sdk';

export class InventorySkill extends SkillBase {
  static override SKILL_NAME = 'inventory';
  static override SKILL_DESCRIPTION = 'Checks product inventory levels.';
  static override SKILL_VERSION = '1.0.0';
  static override REQUIRED_ENV_VARS = ['INVENTORY_DB_URL'] as const;

  private db: Map<string, number> = new Map();

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      low_stock_threshold: {
        type: 'integer',
        description: 'Quantity at or below which a product is low stock.',
        default: 10,
        required: false,
      },
    };
  }

  // Runs once when the skill is added. Return false to refuse the skill.
  override async setup(): Promise<boolean> {
    // Connect to the database named by INVENTORY_DB_URL and load data here.
    this.db.set('widget-a', 150);
    this.db.set('widget-b', 3);
    return true;
  }

  // Runs when the skill is removed.
  override async cleanup(): Promise<void> {
    this.db.clear();
  }

  override getTools(): SkillToolDefinition[] {
    const threshold = this.getConfig<number>('low_stock_threshold', 10);

    return [
      {
        name: 'check_inventory',
        description: 'Check the current inventory level for a product.',
        parameters: {
          product_id: { type: 'string', description: 'The product ID to check.' },
        },
        required: ['product_id'],
        secure: true,
        fillers: { 'en-US': ['Let me check our stock levels.', 'One moment.'] },
        handler: (args: Record<string, unknown>) => {
          const productId = String(args.product_id ?? '');
          const quantity = this.db.get(productId);
          if (quantity === undefined) {
            return new FunctionResult(`Product "${productId}" was not found in inventory.`);
          }
          const status = quantity <= threshold ? 'low stock' : 'in stock';
          return new FunctionResult(`Product ${productId}: ${quantity} units, ${status}.`);
        },
      },
    ];
  }

  protected override _getPromptSections(): SkillPromptSection[] {
    return [
      {
        title: 'Inventory Lookup',
        body: 'You can check product inventory levels for customers.',
        bullets: [
          'Use the check_inventory tool when a customer asks whether a product is available.',
          'If a product is low stock, tell the customer.',
        ],
      },
    ];
  }

  override getHints(): string[] {
    return ['inventory', 'stock', 'availability', 'in stock', 'out of stock'];
  }

  override getGlobalData(): Record<string, unknown> {
    return { low_stock_threshold: this.getConfig<number>('low_stock_threshold', 10) };
  }
}
```

Override `_getPromptSections()`, not `getPromptSections()`. The public method returns nothing when `skip_prompt` is `true`, and calls `_getPromptSections()` otherwise.

### SkillBase Members Reference

These are the members a skill sets or overrides:

| Member | Required | Description |
|---|---|---|
| `static SKILL_NAME` | Yes | Unique skill name, such as `'greeting'`. The constructor throws when it's empty. |
| `static SKILL_DESCRIPTION` | Yes | Description shown in registry listings. The constructor throws when it's empty. |
| `static SKILL_VERSION` | No | Version string. Defaults to `'1.0.0'`. |
| `static REQUIRED_ENV_VARS` | No | Environment variables that must be set, or the skill doesn't load |
| `static REQUIRED_PACKAGES` | No | npm packages that must import, or the skill doesn't load |
| `static SUPPORTS_MULTIPLE_INSTANCES` | No | Allows more than one instance on an agent. Defaults to `false`. |
| `static getParameterSchema()` | No | The skill's parameter schema. Must return a non-empty object; the base returns `swaig_fields` and `skip_prompt`. |
| `getTools()` | No | Tool definitions. The default returns the tools added with the protected `defineTool()`. |
| `getDataMapTools()` | No | Complete SWAIG function objects, such as `DataMap.toSwaigFunction()` output |
| `setup()` | No | Async initialization. Return `false` to refuse the skill. |
| `cleanup()` | No | Async teardown when the skill is removed |
| `_getPromptSections()` | No | Prompt sections, returned through `getPromptSections()` unless `skip_prompt` is set |
| `getHints()` | No | Speech recognition hints |
| `getGlobalData()` | No | Keys merged into the agent's global data |
| `getInstanceKey()` | No | Key that tells instances apart. The default is the skill name, or `<name>_<tool_name>` for a multi-instance skill. |

A skill can also call these helpers:

| Member | Description |
|---|---|
| `getConfig(key, default)` | Reads a configuration value, with a default |
| `params` | The whole configuration, read-only, without `swaig_fields` |
| `agent` | The agent the skill was added to, set before `setup()` runs |
| `logger` | A logger named `signalwire.skills.<SKILL_NAME>` (protected) |
| `validateEnvVars()` | Returns the missing `REQUIRED_ENV_VARS` names |
| `validatePackages()` | Resolves to the `REQUIRED_PACKAGES` names that don't import |
| `getSkillData(rawData)` | Reads this skill's state from a request's global data |
| `updateSkillData(result, data)` | Stores this skill's state on a `FunctionResult` through `updateGlobalData()` |
| `isInitialized()` | Whether `setup()` has completed |

### SkillToolDefinition Fields

A tool definition has these fields:

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes | Tool name |
| `description` | `string` | Yes | Description the model reads |
| `parameters` | `Record<string, unknown>` | No | JSON Schema properties, keyed by argument name |
| `required` | `string[]` | No | Names of required arguments |
| `handler` | `SwaigHandler` | Yes | Called with `(args, rawData, agent)` when the tool runs |
| `secure` | `boolean` | No | Requires a valid per-call token. Tools are secure unless this is `false`. |
| `fillers` | `Record<string, string[]>` | No | Filler phrases by language code, spoken while the tool runs |
| `wait_for_fillers` | `boolean` | No | Wait for fillers in progress to finish before the tool runs |
| `skip_fillers` | `boolean` | No | Don't play fillers for this tool |
| `isHangupHook` | `boolean` | No | Adds `is_hangup_hook: true` to the tool's SWAIG function definition |

To get typed `args` in a handler, wrap the definition in `defineSkillTool()`. It infers the argument types from `parameters` and `required`, and returns an ordinary `SkillToolDefinition`.

### SkillPromptSection Fields

A prompt section has these fields:

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | `string` | Yes | Section heading |
| `body` | `string` | No | Body text |
| `bullets` | `string[]` | No | Bullet points after the body |
| `numbered` | `boolean` | No | Render the bullets as a numbered list |

---

## Skill Lifecycle

A skill goes through these phases:

```text
constructor -> addSkill() checks -> setup() -> registration -> tool calls -> cleanup()
```

### 1. Construction

The constructor stores the configuration and moves `swaig_fields` out of it. It also sets the `instanceId` from the skill name, a timestamp and random bytes:

```typescript
import { DateTimeSkill } from '@signalwire/sdk';

const skill = new DateTimeSkill();
console.log(skill.skillName); // 'datetime'
console.log(skill.isInitialized()); // false
```

### 2. Setup

`agent.addSkill(skill)` sets the skill's `agent`, and the `SkillManager` runs the checks listed in [Using Skills](#agentaddskill). Then it awaits `setup()`, and marks the skill initialized when `setup()` returns `true`. This `setup()` refuses to load without a key:

<!-- snippet: no-compile illustrative bare method fragment (class body context) -->
```typescript
override async setup(): Promise<boolean> {
  const apiKey = this.getConfig<string>('api_key') ?? process.env['MY_API_KEY'];
  if (!apiKey) {
    this.logger.error('api_key or MY_API_KEY is required');
    return false;
  }
  this.client = await connectToService(apiKey);
  return true;
}
```

### 3. Registration

After setup, `AgentBase.addSkill()` registers what the skill contributes:

- Each tool from `getTools()` through `defineTool()`, with `swaig_fields` merged in
- Each object from `getDataMapTools()` through `registerSwaigFunction()`
- Each section from `getPromptSections()` through `promptAddSection()`
- The hints from `getHints()` through `addHints()`
- The data from `getGlobalData()` through `updateGlobalData()`

### 4. Active Use

The model calls the skill's tools during calls, and the skill instance stays in memory while it's loaded. A per-request copy of the agent, made for a dynamic config callback or `addPerCallConfig()`, shares the loaded skill instances without running `setup()` again.

### 5. Cleanup

`agent.removeSkill()` calls the skill's `cleanup()`, then removes it. `SkillManager.clear()` does the same for every loaded skill. This `cleanup()` closes a connection:

<!-- snippet: no-compile illustrative bare method fragment (class body context) -->
```typescript
override async cleanup(): Promise<void> {
  await this.client.disconnect();
}
```

Removing a skill doesn't unregister the tools, prompt sections, hints or global data it already added to the agent.

---

## Environment Validation

A skill lists the environment variables it needs in the static `REQUIRED_ENV_VARS`. The check runs when the skill is added, and a missing variable stops it from loading.

### Declaring Required Env Vars

This skill needs two variables:

```typescript
import { SkillBase, type SkillToolDefinition } from '@signalwire/sdk';

export class MyApiSkill extends SkillBase {
  static override SKILL_NAME = 'my_api_skill';
  static override SKILL_DESCRIPTION = 'Integrates with My API.';
  static override REQUIRED_ENV_VARS = ['MY_API_KEY', 'MY_API_SECRET'] as const;

  override getTools(): SkillToolDefinition[] {
    return [];
  }
}
```

### Automatic Validation

When a variable is missing, `addSkill()` rejects with `Cannot load skill '<name>': missing environment variables: <names>`, and the skill isn't added. `SkillManager.loadSkill()` and `loadSkillByName()` catch the error and resolve to `[false, message]` instead.

A variable in `REQUIRED_ENV_VARS` is required even when the skill also accepts the value as a parameter. For a key that can come from either, leave it out of `REQUIRED_ENV_VARS` and check both in `setup()`, as `web_search` does.

### Manual Validation

`validateEnvVars()` returns the names of the missing variables, and logs an error when there are any:

```typescript
import { SkillBase } from '@signalwire/sdk';

class MyApiSkill extends SkillBase {
  static override SKILL_NAME = 'my_api_skill';
  static override SKILL_DESCRIPTION = 'Integrates with My API.';
  static override REQUIRED_ENV_VARS = ['MY_API_KEY', 'MY_API_SECRET'] as const;
}

const skill = new MyApiSkill();
const missing = skill.validateEnvVars();
if (missing.length > 0) {
  console.warn(`Missing env vars: ${missing.join(', ')}`);
}
```

`hasAllEnvVars()` returns the same check as a boolean.

### Runtime Handling

Some built-in skills also check their credentials when a tool runs, and return a message the model can relay instead of throwing:

<!-- snippet: no-compile illustrative handler-body fragment (bare `return` outside a function) -->
```typescript
// Inside a tool handler
const apiKey = this.getConfig<string | undefined>('api_key') ?? process.env['GOOGLE_MAPS_API_KEY'];
if (!apiKey) {
  return new FunctionResult('Service is not configured. Please contact your administrator.');
}
```

---

## Environment Variables Reference

The built-in skills and the registry read these variables:

| Variable | Used by |
|---|---|
| `WEATHER_API_KEY` | `weather_api` (when `api_key` isn't set) |
| `API_NINJAS_KEY` | `api_ninjas_trivia` (when `api_key` isn't set) |
| `GOOGLE_SEARCH_API_KEY` | `web_search` (when `api_key` isn't set) |
| `GOOGLE_SEARCH_ENGINE_ID`, `GOOGLE_SEARCH_CX` | `web_search` (when `search_engine_id` isn't set) |
| `GOOGLE_MAPS_API_KEY` | `google_maps` (when `api_key` isn't set) |
| `SIGNALWIRE_SPACE`, `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_API_TOKEN` | `datasphere` (when the matching parameter isn't set) |
| `ANTHROPIC_API_KEY` | `ask_claude` (when `api_key` isn't set) |
| `MCP_GATEWAY_AUTH_TOKEN`, `MCP_GATEWAY_AUTH_USER`, `MCP_GATEWAY_AUTH_PASSWORD` | `mcp_gateway` (when the matching parameter isn't set) |
| `SWML_ALLOW_CUSTOM_HANDLER_CODE` | `custom_skills`: `true` lets `handler_code` run |
| `SWML_ALLOW_PRIVATE_URLS` | `spider`, `web_search`, `native_vector_search` and `mcp_gateway`: `1`, `true` or `yes` allows private and internal addresses |
| `SWML_URL_FETCH_USE_PROXY` | `spider` and `web_search`: lets page fetches use the environment's proxy |
| `SWML_SKILL_DISCOVERY_ENABLED` | `SkillRegistry`: `true` allows directory discovery |
| `SIGNALWIRE_SKILL_PATHS` | `SkillRegistry`: colon-separated discovery paths |

The SDK's own tests set `WEATHER_API_BASE_URL`, `API_NINJAS_BASE_URL`, `WEB_SEARCH_BASE_URL`, `WIKIPEDIA_BASE_URL`, `DATASPHERE_BASE_URL` and `SPIDER_BASE_URL` to send requests to a local server. Leave them unset in production. `SPIDER_BASE_URL` sends every spider request to that server without the private-address check.
