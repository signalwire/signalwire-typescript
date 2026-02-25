# Skills System Guide

Complete guide to the Skills system in the SignalWire AI Agents TypeScript SDK -- modular, reusable capabilities that can be added to any agent.

---

## Table of Contents

1. [Overview](#overview)
2. [Using Skills](#using-skills)
3. [Built-in Skills (18)](#built-in-skills-18)
4. [Skill Configuration](#skill-configuration)
5. [Skill Registry](#skill-registry)
6. [Creating Custom Skills](#creating-custom-skills)
7. [Skill Lifecycle](#skill-lifecycle)
8. [Environment Validation](#environment-validation)

---

## Overview

Skills are **modular capabilities** that can be added to an agent at runtime. Each skill encapsulates one or more SWAIG tools, prompt sections, speech recognition hints, and global data -- everything needed to give an agent a new ability.

The skills system is built on three core classes:

| Class | Role | Location |
|---|---|---|
| `SkillBase` | Abstract base class that all skills extend | `src/skills/SkillBase.ts` |
| `SkillManager` | Manages the lifecycle of skills attached to an agent | `src/skills/SkillManager.ts` |
| `SkillRegistry` | Global singleton registry for discovering and instantiating skills by name | `src/skills/SkillRegistry.ts` |

**What a skill provides:**

- **Tools** -- SWAIG function definitions (name, description, parameters, handler) registered with the agent.
- **Prompt sections** -- Text injected into the agent's system prompt to instruct the AI on how to use the skill's tools.
- **Hints** -- Speech recognition hints to improve ASR accuracy for skill-related vocabulary.
- **Global data** -- Key-value pairs merged into the agent's global data store.
- **Manifest** -- Metadata describing the skill's name, version, required environment variables, and configuration schema.

---

## Using Skills

### `agent.addSkill()`

The primary way to add a skill to an agent. This is an async operation because skills may perform setup work (API connections, config validation, etc.):

```typescript
import { AgentBase } from 'signalwire-agents';
import { DateTimeSkill, WebSearchSkill } from 'signalwire-agents/skills/builtin';

const agent = new AgentBase({ name: 'my-agent' });

// Add skills (async)
await agent.addSkill(new DateTimeSkill());
await agent.addSkill(new WebSearchSkill({ max_results: 3 }));
```

When `addSkill()` is called, the agent:

1. Validates the skill's required environment variables (warns if missing).
2. Calls `skill.setup()` for initialization.
3. Marks the skill as initialized.
4. Registers all tools from `skill.getTools()` with the agent via `defineTool()`.
5. Injects all prompt sections from `skill.getPromptSections()` into the agent's prompt.
6. Adds all hints from `skill.getHints()`.
7. Merges all global data from `skill.getGlobalData()`.

### `agent.removeSkill()`

Remove a skill by its unique instance ID. Calls `cleanup()` on the skill before removal:

```typescript
const removed = await agent.removeSkill('datetime-abc123-def456');
// returns true if found and removed, false otherwise
```

### `agent.listSkills()`

List all currently loaded skills with their metadata:

```typescript
const skills = agent.listSkills();
// Returns: [{ name: 'datetime', instanceId: 'datetime-abc123-def456', initialized: true }, ...]

for (const skill of skills) {
  console.log(`${skill.name} (${skill.instanceId}) - initialized: ${skill.initialized}`);
}
```

### `agent.hasSkill()`

Check whether a skill with a given name is currently registered:

```typescript
if (agent.hasSkill('web_search')) {
  console.log('Web search is available');
}
```

---

## Built-in Skills (18)

The SDK ships with 18 built-in skills organized into three tiers based on complexity and dependency requirements.

### Tier 1: Simple (No External Dependencies)

These skills work out of the box with no API keys or configuration.

| Skill Name | Class | Description | Tools | Required Env Vars | Config Options |
|---|---|---|---|---|---|
| `datetime` | `DateTimeSkill` | Current date/time with timezone support | `get_datetime` | None | None |
| `math` | `MathSkill` | Safe mathematical expression evaluation | `calculate` | None | None |
| `joke` | `JokeSkill` | Random jokes from built-in collection | `tell_joke` | None | None |

**datetime** -- Provides the current date and time in any IANA timezone via the `get_datetime` tool. Uses the `Intl.DateTimeFormat` API.

```typescript
import { DateTimeSkill } from 'signalwire-agents/skills/builtin';
await agent.addSkill(new DateTimeSkill());
```

**math** -- Evaluates mathematical expressions safely using a sandboxed parser. Supports `+`, `-`, `*`, `/`, `^`, `%`, and parentheses. Only allows digits, operators, parentheses, decimal points, and spaces.

```typescript
import { MathSkill } from 'signalwire-agents/skills/builtin';
await agent.addSkill(new MathSkill());
```

**joke** -- Tells random jokes from a curated built-in collection. Categories: `general`, `programming`, `dad`.

```typescript
import { JokeSkill } from 'signalwire-agents/skills/builtin';
await agent.addSkill(new JokeSkill());
```

---

### Tier 2: Single API (Simple External Integration)

These skills integrate with a single external API or provide focused call-control features.

| Skill Name | Class | Description | Tools | Required Env Vars | Config Options |
|---|---|---|---|---|---|
| `weather_api` | `WeatherApiSkill` | Current weather from OpenWeatherMap | `get_weather` | `WEATHER_API_KEY` | `units` |
| `play_background_file` | `PlayBackgroundFileSkill` | Background audio playback during calls | `play_background`, `stop_background` | None | `default_file_url`, `allowed_domains` |
| `swml_transfer` | `SwmlTransferSkill` | Call transfer via SWML actions | `transfer_call`, `list_transfer_destinations` | None | `patterns`, `allow_arbitrary`, `default_message` |
| `api_ninjas_trivia` | `ApiNinjasTriviaSkill` | Trivia questions from API Ninjas | `get_trivia` | `API_NINJAS_KEY` | `default_category`, `reveal_answer` |
| `info_gatherer` | `InfoGathererSkill` | Structured data collection from users | `save_info`, `get_gathered_info` | None | `fields`, `purpose`, `confirmation_message`, `store_globally` |
| `custom_skills` | `CustomSkillsSkill` | User-defined tools from configuration | Dynamic (from config) | None | `tools`, `prompt_title`, `prompt_body` |

**weather_api** -- Fetches current weather data from OpenWeatherMap. Supports metric, imperial, and standard units.

```typescript
import { WeatherApiSkill } from 'signalwire-agents/skills/builtin';
await agent.addSkill(new WeatherApiSkill({ units: 'imperial' }));
```

**play_background_file** -- Controls background audio playback during calls (hold music, ambient sounds). Supports domain restrictions for audio file URLs.

```typescript
import { PlayBackgroundFileSkill } from 'signalwire-agents/skills/builtin';
await agent.addSkill(new PlayBackgroundFileSkill({
  default_file_url: 'https://example.com/hold-music.mp3',
  allowed_domains: ['example.com', 'cdn.example.com'],
}));
```

**swml_transfer** -- Transfers calls using SWML transfer actions. Supports named destination patterns and arbitrary transfers.

```typescript
import { SwmlTransferSkill } from 'signalwire-agents/skills/builtin';
await agent.addSkill(new SwmlTransferSkill({
  patterns: [
    { name: 'billing', destination: '+15551234567', description: 'Billing department' },
    { name: 'support', destination: 'sip:support@example.com', description: 'Technical support' },
  ],
  allow_arbitrary: false,
  default_message: 'Please hold while I transfer you.',
}));
```

**api_ninjas_trivia** -- Fetches trivia questions with optional category filtering. Categories include `general`, `sciencenature`, `entertainment`, `historyholidays`, `geography`, `music`, `mathematics`, and more.

```typescript
import { ApiNinjasTriviaSkill } from 'signalwire-agents/skills/builtin';
await agent.addSkill(new ApiNinjasTriviaSkill({
  default_category: 'sciencenature',
  reveal_answer: false, // AI quizzes the user
}));
```

**info_gatherer** -- Collects structured information from users based on configurable field definitions with optional validation patterns. Data is stored per-call and can optionally be persisted to global data.

```typescript
import { InfoGathererSkill } from 'signalwire-agents/skills/builtin';
await agent.addSkill(new InfoGathererSkill({
  purpose: 'Collecting customer contact information for our records.',
  fields: [
    { name: 'full_name', description: 'Customer full name', required: true },
    { name: 'email', description: 'Email address', required: true, validation: '^[\\w.+-]+@[\\w-]+\\.[\\w.]+$' },
    { name: 'phone', description: 'Phone number', required: false },
  ],
  confirmation_message: 'Thank you! Your information has been saved.',
  store_globally: true,
}));
```

**custom_skills** -- A meta-skill that registers user-defined tools from configuration without writing skill classes. Handler code is compiled via the `Function` constructor at instantiation time.

```typescript
import { CustomSkillsSkill } from 'signalwire-agents/skills/builtin';
await agent.addSkill(new CustomSkillsSkill({
  prompt_title: 'Greeting Tools',
  tools: [
    {
      name: 'get_greeting',
      description: 'Get a personalized greeting for a customer.',
      parameters: [
        { name: 'name', type: 'string', description: 'Customer name', required: true },
      ],
      handler_code: 'return new SwaigFunctionResult(`Hello, ${args.name}! Welcome back.`);',
      required: ['name'],
    },
  ],
}));
```

---

### Tier 3: Complex (Multi-API or Advanced)

These skills involve complex integrations, multiple API calls, or advanced processing.

| Skill Name | Class | Description | Tools | Required Env Vars | Config Options |
|---|---|---|---|---|---|
| `web_search` | `WebSearchSkill` | Google Custom Search | `web_search` | `GOOGLE_SEARCH_API_KEY`, `GOOGLE_SEARCH_CX` | `max_results`, `safe_search` |
| `wikipedia_search` | `WikipediaSearchSkill` | Wikipedia article summaries | `search_wikipedia` | None | None |
| `google_maps` | `GoogleMapsSkill` | Directions and place search | `get_directions`, `find_place` | `GOOGLE_MAPS_API_KEY` | `default_mode` |
| `datasphere` | `DataSphereSkill` | SignalWire DataSphere semantic search | `search_datasphere` | `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_TOKEN`, `SIGNALWIRE_SPACE` | `max_results`, `distance_threshold` |
| `datasphere_serverless` | `DataSphereServerlessSkill` | DataSphere via server-side DataMap | `search_datasphere` | `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_TOKEN`, `SIGNALWIRE_SPACE` | `max_results`, `distance_threshold`, `document_id` |
| `native_vector_search` | `NativeVectorSearchSkill` | In-memory TF-IDF document search | `search_documents` | None | `documents` |
| `spider` | `SpiderSkill` | Web page scraping via Spider API | `scrape_url` | `SPIDER_API_KEY` | `max_content_length` |
| `claude_skills` | `ClaudeSkill` | Anthropic Claude AI sub-queries | `ask_claude` | `ANTHROPIC_API_KEY` | `model`, `max_tokens` |
| `mcp_gateway` | `McpGatewaySkill` | MCP protocol gateway (placeholder) | `mcp_invoke` | None | None |

**web_search** -- Searches the web using Google Custom Search JSON API. Returns formatted results with titles, links, and snippets.

```typescript
import { WebSearchSkill } from 'signalwire-agents/skills/builtin';
await agent.addSkill(new WebSearchSkill({
  max_results: 5,
  safe_search: 'medium', // 'off' | 'medium' | 'high'
}));
```

**wikipedia_search** -- Searches Wikipedia for article summaries and extracts. Uses the Wikipedia REST API with no API key required. Falls back to the search API if direct page lookup fails.

```typescript
import { WikipediaSearchSkill } from 'signalwire-agents/skills/builtin';
await agent.addSkill(new WikipediaSearchSkill());
```

**google_maps** -- Provides driving/walking/bicycling/transit directions and place search via Google Maps APIs (Directions API and Places Find Place API).

```typescript
import { GoogleMapsSkill } from 'signalwire-agents/skills/builtin';
await agent.addSkill(new GoogleMapsSkill({ default_mode: 'walking' }));
```

**datasphere** -- Searches SignalWire DataSphere for knowledge base content using semantic search across uploaded documents. Results are ranked by relevance score.

```typescript
import { DataSphereSkill } from 'signalwire-agents/skills/builtin';
await agent.addSkill(new DataSphereSkill({
  max_results: 5,
  distance_threshold: 0.7, // 0-1, lower is more similar
}));
```

**datasphere_serverless** -- Like `datasphere`, but uses a server-side DataMap instead of a webhook handler. The search executes entirely on the SignalWire platform, making it ideal for serverless or edge deployments where no webhook endpoint is available.

```typescript
import { DataSphereServerlessSkill } from 'signalwire-agents/skills/builtin';
await agent.addSkill(new DataSphereServerlessSkill({
  max_results: 5,
  distance_threshold: 0.7,
  document_id: 'specific-doc-id', // optional: restrict to one document
}));
```

**native_vector_search** -- In-memory document search using TF-IDF-like word overlap scoring. Documents are provided via configuration and indexed at construction time. No external dependencies or API keys required. Suitable for small to medium document collections.

```typescript
import { NativeVectorSearchSkill } from 'signalwire-agents/skills/builtin';
await agent.addSkill(new NativeVectorSearchSkill({
  documents: [
    { id: 'faq-1', text: 'To reset your password, go to Settings > Security > Change Password.' },
    { id: 'faq-2', text: 'Our business hours are Monday-Friday 9am-5pm EST.' },
    { id: 'faq-3', text: 'Refunds are processed within 5-7 business days.', metadata: { category: 'billing' } },
  ],
}));
```

**spider** -- Scrapes webpage content using the Spider API. Extracts text, markdown, or HTML from any public URL with optional CSS selector filtering.

```typescript
import { SpiderSkill } from 'signalwire-agents/skills/builtin';
await agent.addSkill(new SpiderSkill({
  max_content_length: 5000,
}));
```

**claude_skills** -- Provides access to Anthropic's Claude AI for sub-queries, complex reasoning, analysis, or summarization. The agent can delegate tasks to Claude when deeper processing is needed.

```typescript
import { ClaudeSkill } from 'signalwire-agents/skills/builtin';
await agent.addSkill(new ClaudeSkill({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1024,
}));
```

**mcp_gateway** -- Placeholder skill for future Model Context Protocol (MCP) server integration. Currently provides a non-functional `mcp_invoke` tool. Version 0.1.0 (stub).

```typescript
import { McpGatewaySkill } from 'signalwire-agents/skills/builtin';
await agent.addSkill(new McpGatewaySkill());
```

---

## Skill Configuration

Skills accept configuration via a `SkillConfig` key-value object passed to the constructor:

```typescript
interface SkillConfig {
  [key: string]: unknown;
}
```

### Accessing Config in Skills

Skills use `this.getConfig<T>(key, defaultValue)` to read configuration values with type safety and defaults:

```typescript
// Inside a skill class
const maxResults = this.getConfig<number>('max_results', 5);
const safeSearch = this.getConfig<string>('safe_search', 'medium');
const patterns = this.getConfig<TransferPattern[]>('patterns', []);
```

### Config Schema in Manifests

Skills declare their expected configuration in the manifest's `configSchema` field. This is a JSON-schema-like description used for documentation and tooling:

```typescript
getManifest(): SkillManifest {
  return {
    name: 'my_skill',
    description: 'Does something useful.',
    version: '1.0.0',
    configSchema: {
      max_results: {
        type: 'number',
        description: 'Maximum number of results to return.',
        default: 5,
      },
      safe_search: {
        type: 'string',
        description: 'Safe search level: "off", "medium", or "high".',
        default: 'medium',
      },
    },
  };
}
```

---

## Skill Registry

The `SkillRegistry` is a global singleton that maps skill names to factory functions. It enables skill discovery and instantiation by name.

### Getting the Registry

```typescript
import { SkillRegistry } from 'signalwire-agents/skills';

const registry = SkillRegistry.getInstance();
```

### Registering Built-in Skills

All 18 built-in skills can be registered at once:

```typescript
import { registerBuiltinSkills } from 'signalwire-agents/skills/builtin';

registerBuiltinSkills();
// Now all built-in skills are available via registry.create('datetime'), etc.
```

This function skips registration for any skill name already present, so it is safe to call multiple times.

### Manual Registration

Register a custom skill factory:

```typescript
registry.register('my_custom_skill', (config) => new MyCustomSkill(config));
```

Register with a manifest for introspection:

```typescript
registry.register('my_custom_skill', (config) => new MyCustomSkill(config), {
  name: 'my_custom_skill',
  description: 'Does custom things.',
  version: '1.0.0',
});
```

### Creating Instances by Name

```typescript
const skill = registry.create('datetime');
if (skill) {
  await agent.addSkill(skill);
}

// With config
const weatherSkill = registry.create('weather_api', { units: 'imperial' });
```

Returns `null` if the skill name is not registered.

### Querying the Registry

```typescript
// Check if a skill is registered
registry.has('datetime'); // true

// List all registered skill names
const names = registry.listRegistered();
// ['datetime', 'math', 'joke', ...]

// List with manifests
const withManifests = registry.listRegisteredWithManifests();
// [{ name: 'datetime', manifest: { ... } }, ...]

// Get a specific manifest
const manifest = registry.getManifest('web_search');

// Count of registered skills
const count = registry.size;
```

### Skill Discovery from Directories

The registry can auto-discover skills from filesystem directories:

```typescript
// Add a search path
registry.addSearchPath('/path/to/my/skills');

// Discover and register skills from a specific directory
const discovered = await registry.discoverFromDirectory('/path/to/my/skills');
// Returns array of newly discovered skill names

// Discover from all configured search paths
const allDiscovered = await registry.discoverAll();
```

Discovery looks for modules that export either:
- A `createSkill` factory function, or
- A default export that is a `SkillBase` subclass

The `SIGNALWIRE_SKILL_PATHS` environment variable can set additional search paths (colon-separated):

```bash
export SIGNALWIRE_SKILL_PATHS="/app/skills:/shared/skills"
```

### Cleanup

```typescript
// Unregister a single skill
registry.unregister('my_skill');

// Clear all registrations
registry.clear();

// Reset the singleton (for testing)
SkillRegistry.resetInstance();
```

---

## Creating Custom Skills

To create a custom skill, extend `SkillBase` and implement the required abstract methods.

### Minimal Custom Skill

```typescript
import { SkillBase, SkillManifest, SkillToolDefinition, SkillConfig } from 'signalwire-agents/skills';
import { SwaigFunctionResult } from 'signalwire-agents';

export class GreetingSkill extends SkillBase {
  constructor(config?: SkillConfig) {
    super('greeting', config);
  }

  getManifest(): SkillManifest {
    return {
      name: 'greeting',
      description: 'Provides personalized greetings.',
      version: '1.0.0',
      author: 'My Team',
      tags: ['utility', 'greeting'],
    };
  }

  getTools(): SkillToolDefinition[] {
    const style = this.getConfig<string>('style', 'formal');

    return [
      {
        name: 'greet_customer',
        description: 'Generate a personalized greeting for a customer.',
        parameters: {
          name: {
            type: 'string',
            description: 'The customer name.',
          },
        },
        required: ['name'],
        handler: (args: Record<string, unknown>) => {
          const name = args.name as string;
          if (style === 'casual') {
            return new SwaigFunctionResult(`Hey ${name}! What's up?`);
          }
          return new SwaigFunctionResult(`Good day, ${name}. How may I assist you?`);
        },
      },
    ];
  }
}

// Factory function (required for registry discovery)
export function createSkill(config?: SkillConfig): GreetingSkill {
  return new GreetingSkill(config);
}
```

### Full-Featured Custom Skill

```typescript
import {
  SkillBase,
  SkillManifest,
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
} from 'signalwire-agents/skills';
import { SwaigFunctionResult } from 'signalwire-agents';

export class InventorySkill extends SkillBase {
  private db: Map<string, number> = new Map();

  constructor(config?: SkillConfig) {
    super('inventory', config);
  }

  getManifest(): SkillManifest {
    return {
      name: 'inventory',
      description: 'Checks product inventory levels.',
      version: '1.0.0',
      author: 'Acme Corp',
      tags: ['inventory', 'products', 'e-commerce'],
      requiredEnvVars: ['INVENTORY_DB_URL'],
      configSchema: {
        low_stock_threshold: {
          type: 'number',
          description: 'Quantity below which a product is considered low stock.',
          default: 10,
        },
      },
    };
  }

  // Initialization -- called when the skill is added to an agent
  async setup(): Promise<void> {
    const dbUrl = process.env['INVENTORY_DB_URL'];
    // ... connect to database, load initial data ...
    this.db.set('widget-a', 150);
    this.db.set('widget-b', 3);
  }

  // Cleanup -- called when the skill is removed
  async cleanup(): Promise<void> {
    // ... close database connection ...
    this.db.clear();
  }

  getTools(): SkillToolDefinition[] {
    const threshold = this.getConfig<number>('low_stock_threshold', 10);

    return [
      {
        name: 'check_inventory',
        description: 'Check the current inventory level for a product.',
        parameters: {
          product_id: {
            type: 'string',
            description: 'The product ID to check.',
          },
        },
        required: ['product_id'],
        secure: true, // requires authenticated invocation
        fillers: {
          'en-US': ['Let me check our stock levels...', 'One moment...'],
        },
        handler: (args: Record<string, unknown>) => {
          const productId = args.product_id as string;
          const quantity = this.db.get(productId);

          if (quantity === undefined) {
            return new SwaigFunctionResult(`Product "${productId}" not found in inventory.`);
          }

          const status = quantity <= threshold ? 'LOW STOCK' : 'In Stock';
          return new SwaigFunctionResult(
            `Product ${productId}: ${quantity} units available (${status}).`
          );
        },
      },
    ];
  }

  getPromptSections(): SkillPromptSection[] {
    return [
      {
        title: 'Inventory Lookup',
        body: 'You can check product inventory levels for customers.',
        bullets: [
          'Use the check_inventory tool when a customer asks about product availability.',
          'If a product is low stock, proactively let the customer know.',
          'Suggest alternatives if a product is out of stock.',
        ],
      },
    ];
  }

  getHints(): string[] {
    return ['inventory', 'stock', 'availability', 'in stock', 'out of stock'];
  }

  getGlobalData(): Record<string, unknown> {
    return {
      inventory_skill_version: '1.0.0',
      low_stock_threshold: this.getConfig<number>('low_stock_threshold', 10),
    };
  }
}

export function createSkill(config?: SkillConfig): InventorySkill {
  return new InventorySkill(config);
}
```

### SkillBase Methods Reference

| Method | Required | Description |
|---|---|---|
| `getManifest()` | Yes (abstract) | Returns the skill manifest with name, description, version, env vars, and config schema |
| `getTools()` | Yes (abstract) | Returns array of SWAIG tool definitions to register with the agent |
| `setup()` | No | Async initialization hook called when the skill is added to an agent |
| `cleanup()` | No | Async teardown hook called when the skill is removed |
| `getPromptSections()` | No | Returns prompt sections injected into the agent's system prompt |
| `getHints()` | No | Returns speech recognition hint strings |
| `getGlobalData()` | No | Returns key-value data merged into the agent's global data store |
| `validateEnvVars()` | No | Checks required env vars from manifest; returns array of missing names |
| `getConfig(key, default)` | No | Reads a configuration value with type-safe default |
| `isInitialized()` | No | Returns whether `setup()` has completed |

### SkillToolDefinition Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes | Unique tool name for SWAIG function registration |
| `description` | `string` | Yes | Human-readable description shown to the AI |
| `parameters` | `Record<string, unknown>` | No | Parameter schema keyed by parameter name |
| `handler` | `SwaigHandler` | Yes | Function invoked when the tool is called |
| `secure` | `boolean` | No | Whether the tool requires authenticated invocation |
| `fillers` | `Record<string, string[]>` | No | Filler phrases spoken while the tool executes, keyed by language |
| `required` | `string[]` | No | List of required parameter names |

### SkillPromptSection Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | `string` | Yes | Section heading displayed in the prompt |
| `body` | `string` | No | Body text for the section |
| `bullets` | `string[]` | No | Bullet points appended after the body |
| `numbered` | `boolean` | No | If true, render bullets as a numbered list |

---

## Skill Lifecycle

The lifecycle of a skill follows these phases:

```
Construction -> setup() -> register tools/prompts/hints -> active use -> cleanup()
```

### 1. Construction

The skill is instantiated with a name and optional config. The `instanceId` is generated automatically (combination of skill name, timestamp, and random bytes):

```typescript
const skill = new DateTimeSkill({ /* config */ });
// skill.skillName === 'datetime'
// skill.instanceId === 'datetime-m2abc123-deadbeef'
// skill.isInitialized() === false
```

### 2. Setup

When `agent.addSkill(skill)` is called, the `SkillManager`:

1. Checks for duplicate instance IDs.
2. Calls `skill.validateEnvVars()` and logs warnings for any missing environment variables.
3. Calls `await skill.setup()` for async initialization.
4. Calls `skill.markInitialized()`.

```typescript
// Inside a custom skill
async setup(): Promise<void> {
  // Connect to databases, validate API keys, pre-load data, etc.
  const apiKey = process.env['MY_API_KEY'];
  if (!apiKey) throw new Error('API key is required');
  this.client = await connectToService(apiKey);
}
```

### 3. Registration

After setup, the agent registers the skill's contributions:

- **Tools** from `getTools()` are registered via `agent.defineTool()`.
- **Prompt sections** from `getPromptSections()` are injected via `agent.promptAddSection()`.
- **Hints** from `getHints()` are added via `agent.addHints()`.
- **Global data** from `getGlobalData()` is merged via `agent.updateGlobalData()`.

### 4. Active Use

The skill is now active. Its tools are called by the AI during conversations. The skill instance remains in memory for the lifetime of the agent.

### 5. Cleanup

When `agent.removeSkill(instanceId)` is called (or the SkillManager is cleared), the skill's `cleanup()` method is invoked:

```typescript
async cleanup(): Promise<void> {
  // Close connections, release resources, flush caches
  await this.client.disconnect();
}
```

The `SkillManager.clear()` method calls `cleanup()` on all loaded skills and removes them all.

---

## Environment Validation

Skills can declare required environment variables in their manifest. The `validateEnvVars()` method checks which ones are missing.

### In the Manifest

```typescript
getManifest(): SkillManifest {
  return {
    name: 'my_api_skill',
    description: 'Integrates with My API.',
    version: '1.0.0',
    requiredEnvVars: ['MY_API_KEY', 'MY_API_SECRET'],
  };
}
```

### Automatic Validation

When `addSkill()` is called, the `SkillManager` automatically validates env vars and logs warnings for any that are missing. The skill is still added even if env vars are missing -- it is up to the skill's handler to return appropriate error messages at call time.

### Manual Validation

```typescript
const skill = new WebSearchSkill();
const missing = skill.validateEnvVars();

if (missing.length > 0) {
  console.warn(`Missing env vars: ${missing.join(', ')}`);
}
// missing might be ['GOOGLE_SEARCH_API_KEY', 'GOOGLE_SEARCH_CX']
```

### Runtime Handling

Built-in skills check for environment variables at call time and return user-friendly error messages:

```typescript
// Inside a tool handler
const apiKey = process.env['GOOGLE_SEARCH_API_KEY'];
if (!apiKey) {
  return new SwaigFunctionResult(
    'Web search is not configured. The GOOGLE_SEARCH_API_KEY environment variable is required.'
  );
}
```

This two-layer approach (warn at registration, error at call time) allows agents to start up even when some skills are not fully configured, while providing clear feedback when an unconfigured tool is invoked.

---

## Complete Environment Variables Reference

| Env Var | Used By |
|---|---|
| `WEATHER_API_KEY` | `weather_api` |
| `API_NINJAS_KEY` | `api_ninjas_trivia` |
| `GOOGLE_SEARCH_API_KEY` | `web_search` |
| `GOOGLE_SEARCH_CX` | `web_search` |
| `GOOGLE_MAPS_API_KEY` | `google_maps` |
| `SIGNALWIRE_PROJECT_ID` | `datasphere`, `datasphere_serverless` |
| `SIGNALWIRE_TOKEN` | `datasphere`, `datasphere_serverless` |
| `SIGNALWIRE_SPACE` | `datasphere`, `datasphere_serverless` |
| `SPIDER_API_KEY` | `spider` |
| `ANTHROPIC_API_KEY` | `claude_skills` |
| `SIGNALWIRE_SKILL_PATHS` | `SkillRegistry` (directory discovery) |
