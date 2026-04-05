# Skills System Reference

Architectural reference for the Skills system in the SignalWire AI Agents TypeScript SDK.

---

## Table of Contents

1. [Architecture](#architecture)
2. [SkillBase](#skillbase)
3. [SkillManager](#skillmanager)
4. [SkillRegistry](#skillregistry)
5. [Tool Registration Flow](#tool-registration-flow)
6. [Built-in Skills](#built-in-skills)
7. [Creating a Custom Skill](#creating-a-custom-skill)
8. [Multi-Instance Skills](#multi-instance-skills)
9. [Environment Validation](#environment-validation)
10. [Parameter Schema Discovery](#parameter-schema-discovery)
11. [Lifecycle Hooks](#lifecycle-hooks)

---

## Architecture

The skills system consists of three cooperating components:

```
SkillRegistry (singleton)
   |
   +-- registers skill factories by name
   |
   +-- SkillBase subclasses
         |
         +-- provide tools, prompts, hints, global data
         |
         +-- managed by SkillManager (per-agent)
```

| Component | Responsibility |
|---|---|
| **SkillBase** | Abstract base class every skill extends. Declares tools, prompts, hints, and config schema. |
| **SkillManager** | Attached to each `AgentBase`. Loads, validates, and wires skills into the agent. |
| **SkillRegistry** | Global singleton. Maps skill names to factory functions for `agent.addSkill()` lookups. |

---

## SkillBase

All skills extend `SkillBase`. The base class defines the contract:

```typescript
import { SkillBase, FunctionResult } from '@signalwire/sdk';
import type { SkillManifest, SkillToolRegistration } from '@signalwire/sdk';

class MySkill extends SkillBase {
  static manifest: SkillManifest = {
    name: 'my_skill',
    version: '1.0.0',
    description: 'Does something useful',
    requiredEnvVars: ['MY_API_KEY'],
    supportsMultipleInstances: false,
  };

  registerTools(): SkillToolRegistration[] {
    return [
      {
        name: 'my_tool',
        description: 'Performs the action',
        parameters: { query: { type: 'string', description: 'Input' } },
        handler: (args: Record<string, unknown>) => {
          return new FunctionResult(`Result for ${args.query}`);
        },
      },
    ];
  }

  getHints(): string[] {
    return ['my skill', 'useful action'];
  }

  getPromptSections(): Array<{ title: string; body: string; bullets?: string[] }> {
    return [
      {
        title: 'My Skill',
        body: 'You have access to my_tool for performing useful actions.',
      },
    ];
  }

  getGlobalData(): Record<string, unknown> {
    return { my_skill_enabled: true };
  }
}
```

### Key Methods

| Method | Returns | Purpose |
|---|---|---|
| `registerTools()` | `SkillToolRegistration[]` | Define the SWAIG tools this skill provides. |
| `getHints()` | `string[]` | Speech recognition hints for ASR accuracy. |
| `getPromptSections()` | Section array | Prompt text injected into the agent's system prompt. |
| `getGlobalData()` | `Record<string, unknown>` | Key-value pairs merged into agent global data. |
| `setup()` | `Promise<void>` | Async initialization (API connections, file loading). |
| `teardown()` | `Promise<void>` | Cleanup on agent shutdown. |

### SkillManifest Interface

```typescript
interface SkillManifest {
  name: string;                     // Unique skill identifier
  version: string;                  // Semantic version
  description: string;              // Human-readable description
  requiredEnvVars?: string[];       // Environment variables that must be set
  supportsMultipleInstances?: boolean;  // Whether multiple instances can coexist
}
```

---

## SkillManager

Each `AgentBase` has an internal `SkillManager`. When you call `agent.addSkill()`, the manager:

1. Validates required environment variables from the skill manifest.
2. Calls `skill.setup()` for async initialization.
3. Registers all tools from `skill.registerTools()` with the agent.
4. Merges hints from `skill.getHints()` into the agent's hint list.
5. Adds prompt sections from `skill.getPromptSections()` to the POM.
6. Merges global data from `skill.getGlobalData()`.

### Usage

```typescript
import { AgentBase, DateTimeSkill, MathSkill } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'assistant' });

// Add skills
await agent.addSkill(new DateTimeSkill());
await agent.addSkill(new MathSkill());

// Query loaded skills
const skills = agent.listSkills();
// => [{ name: 'datetime', version: '1.0.0', description: '...' }, ...]

// Check if a skill is loaded
if (agent.hasSkill('datetime')) {
  console.log('DateTime skill is active');
}

// Remove a skill
agent.removeSkill('datetime');
```

---

## SkillRegistry

The global registry allows skills to be discovered by name:

```typescript
import { SkillRegistry } from '@signalwire/sdk';

// List all registered skills
const available = SkillRegistry.listSkills();
// => [{ name: 'datetime', description: '...', version: '1.0.0' }, ...]

// Get a skill's parameter schema
const schema = SkillRegistry.getParameterSchema('web_search');
// => { max_results: { type: 'number', default: 5 }, ... }
```

Built-in skills register themselves automatically when imported. Custom skills must call `SkillRegistry.register()`:

```typescript
SkillRegistry.register('my_skill', (config) => new MySkill(config));
```

---

## Tool Registration Flow

```
agent.addSkill(new WebSearchSkill({ max_results: 5 }))
  |
  v
SkillManager.loadSkill(skill)
  |
  +-- validate env vars (GOOGLE_SEARCH_API_KEY, etc.)
  +-- skill.setup()          // async init
  +-- skill.registerTools()  // get tool definitions
  |     |
  |     v
  +-- agent.defineTool(...)  // register each tool on the agent
  +-- agent.addHints(...)    // merge hints
  +-- agent.promptAddSection(...)  // add prompt text
  +-- agent.updateGlobalData(...)  // merge global data
```

---

## Built-in Skills

The SDK includes 18 built-in skills:

| Skill | Class | Tools | Required Env Vars |
|-------|-------|-------|-------------------|
| datetime | `DateTimeSkill` | `get_current_time`, `get_current_date` | -- |
| math | `MathSkill` | `calculate` | -- |
| joke | `JokeSkill` | `tell_joke` | -- |
| weather_api | `WeatherApiSkill` | `get_weather` | `WEATHER_API_KEY` |
| web_search | `WebSearchSkill` | `web_search` | `GOOGLE_SEARCH_API_KEY`, `GOOGLE_SEARCH_ENGINE_ID` |
| wikipedia_search | `WikipediaSearchSkill` | `search_wiki` | -- |
| google_maps | `GoogleMapsSkill` | `lookup_address`, `compute_route` | `GOOGLE_MAPS_API_KEY` |
| spider | `SpiderSkill` | `scrape_url` | -- |
| datasphere | `DataSphereSkill` | `search_datasphere` | `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_TOKEN` |
| datasphere_serverless | `DataSphereServerlessSkill` | `search_datasphere` | `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_TOKEN` |
| swml_transfer | `SwmlTransferSkill` | `transfer_call` | -- |
| play_background_file | `PlayBackgroundFileSkill` | `play_background_file`, `stop_background_file` | -- |
| api_ninjas_trivia | `ApiNinjasTriviaSkill` | `get_trivia` | `API_NINJAS_KEY` |
| native_vector_search | `NativeVectorSearchSkill` | `search_knowledge` | -- |
| info_gatherer | `InfoGathererSkill` | `start_questions`, `submit_answer` | -- |
| claude_skills | `ClaudeSkillsSkill` | *(from SKILL.md files)* | -- |
| mcp_gateway | `McpGatewaySkill` | *(MCP server bridge)* | -- |
| custom_skills | `CustomSkillsSkill` | *(user-defined from config)* | -- |

### Example Usage

```typescript
import {
  AgentBase, DateTimeSkill, MathSkill, WebSearchSkill,
  WeatherApiSkill, WikipediaSearchSkill, JokeSkill,
} from '@signalwire/sdk';

const agent = new AgentBase({ name: 'assistant' });

// Skills without env vars work immediately
await agent.addSkill(new DateTimeSkill());
await agent.addSkill(new MathSkill());
await agent.addSkill(new JokeSkill());
await agent.addSkill(new WikipediaSearchSkill());

// Skills with env vars require them to be set
// WEATHER_API_KEY must be set in the environment
await agent.addSkill(new WeatherApiSkill());

// Skills with custom configuration
await agent.addSkill(new WebSearchSkill({
  max_results: 3,
  safe_search: 'active',
}));
```

---

## Creating a Custom Skill

### Step 1: Extend SkillBase

```typescript
import { SkillBase, FunctionResult } from '@signalwire/sdk';
import type { SkillManifest, SkillToolRegistration } from '@signalwire/sdk';

export class StockPriceSkill extends SkillBase {
  static manifest: SkillManifest = {
    name: 'stock_price',
    version: '1.0.0',
    description: 'Look up current stock prices',
    requiredEnvVars: ['STOCK_API_KEY'],
    supportsMultipleInstances: false,
  };

  private apiKey: string;

  constructor(config: Record<string, unknown> = {}) {
    super(config);
    this.apiKey = process.env['STOCK_API_KEY'] ?? '';
  }

  registerTools(): SkillToolRegistration[] {
    return [
      {
        name: 'get_stock_price',
        description: 'Get the current price of a stock by ticker symbol',
        parameters: {
          ticker: { type: 'string', description: 'Stock ticker symbol (e.g. AAPL)' },
        },
        handler: async (args: Record<string, unknown>) => {
          const ticker = String(args.ticker).toUpperCase();
          const price = await this.fetchPrice(ticker);
          return new FunctionResult(`${ticker} is currently trading at $${price}`);
        },
      },
    ];
  }

  getHints(): string[] {
    return ['stock', 'ticker', 'price', 'market', 'shares', 'NYSE', 'NASDAQ'];
  }

  getPromptSections() {
    return [
      {
        title: 'Stock Price Lookup',
        body: 'You can look up current stock prices using the get_stock_price tool. ' +
              'Ask the user for a ticker symbol if they want a price quote.',
      },
    ];
  }

  getGlobalData() {
    return { stock_skill_enabled: true };
  }

  async setup(): Promise<void> {
    // Validate API key format, warm up connections, etc.
    if (!this.apiKey) {
      throw new Error('STOCK_API_KEY is required');
    }
  }

  private async fetchPrice(ticker: string): Promise<string> {
    const resp = await fetch(
      `https://api.stocks.example.com/price/${ticker}`,
      { headers: { Authorization: `Bearer ${this.apiKey}` } },
    );
    const data = await resp.json() as { price: number };
    return data.price.toFixed(2);
  }
}
```

### Step 2: Register (Optional)

```typescript
import { SkillRegistry } from '@signalwire/sdk';
SkillRegistry.register('stock_price', (config) => new StockPriceSkill(config));
```

### Step 3: Use

```typescript
await agent.addSkill(new StockPriceSkill());
```

---

## Multi-Instance Skills

Some skills support multiple instances with different configurations. Set `supportsMultipleInstances: true` in the manifest and accept a `tool_name` config parameter:

```typescript
import { DataSphereSkill } from '@signalwire/sdk';

// Two DataSphere instances with different knowledge bases
await agent.addSkill(new DataSphereSkill({
  document_id: 'drinks-doc',
  tool_name: 'search_drinks',
}));

await agent.addSkill(new DataSphereSkill({
  document_id: 'food-doc',
  tool_name: 'search_food',
}));
```

Each instance registers its tools under the configured `tool_name`, avoiding collisions.

---

## Environment Validation

Skills declare required environment variables in their manifest. The `SkillManager` checks these before calling `setup()`:

```typescript
static manifest: SkillManifest = {
  name: 'weather_api',
  version: '1.0.0',
  description: 'Weather lookups',
  requiredEnvVars: ['WEATHER_API_KEY'],
};
```

If any required variable is missing, `addSkill()` throws with a descriptive error message listing the missing variables.

```typescript
try {
  await agent.addSkill(new WeatherApiSkill());
} catch (err) {
  // Error: Missing required environment variables for weather_api: WEATHER_API_KEY
}
```

---

## Parameter Schema Discovery

Skills can expose their configuration schema for tooling and documentation:

```typescript
// Get the parameter schema for a skill class
const schema = WebSearchSkill.getParameterSchema();
// => { max_results: { type: 'number', default: 5 }, safe_search: { type: 'string', ... } }

// Via the registry
const schema2 = SkillRegistry.getParameterSchema('web_search');
```

This allows external tools to generate configuration UIs or validate config objects before passing them to the skill constructor.

---

## Lifecycle Hooks

| Hook | When | Use Case |
|---|---|---|
| `constructor(config)` | Instantiation | Store config, set defaults. |
| `setup()` | During `addSkill()` | Async init: connect to APIs, load data. |
| `registerTools()` | During `addSkill()` | Return tool definitions. |
| `teardown()` | Agent shutdown | Close connections, flush buffers. |

All hooks are called by the `SkillManager` in the order shown above.

### Example with Lifecycle Hooks

```typescript
class DatabaseSkill extends SkillBase {
  static manifest: SkillManifest = {
    name: 'database',
    version: '1.0.0',
    description: 'Query a database',
    requiredEnvVars: ['DATABASE_URL'],
  };

  private connection: DatabaseConnection | null = null;

  async setup(): Promise<void> {
    // Connect to the database during skill loading
    this.connection = await connect(process.env['DATABASE_URL']!);
  }

  registerTools() {
    return [
      {
        name: 'query_db',
        description: 'Run a read-only database query',
        parameters: {
          query: { type: 'string', description: 'SQL query' },
        },
        handler: async (args: Record<string, unknown>) => {
          const rows = await this.connection!.query(args.query as string);
          return new FunctionResult(`Found ${rows.length} results.`);
        },
      },
    ];
  }

  async teardown(): Promise<void> {
    // Close the database connection on shutdown
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }
}
```
