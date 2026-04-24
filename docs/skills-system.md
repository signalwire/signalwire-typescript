# Skills System Reference

Architectural reference for the Skills system in the SignalWire AI Agents TypeScript SDK.

> **See also:** [skills-guide.md](skills-guide.md) for usage patterns and built-in skill details.

---

## Table of Contents

1. [Architecture](#architecture)
2. [SkillBase](#skillbase)
3. [SkillManager](#skillmanager)
4. [SkillRegistry](#skillregistry)
5. [Tool Registration Flow](#tool-registration-flow)
6. [Creating a Custom Skill](#creating-a-custom-skill)
7. [Multi-Instance Skills](#multi-instance-skills)
8. [Environment Validation](#environment-validation)
9. [Parameter Schema Discovery](#parameter-schema-discovery)
10. [Lifecycle Hooks](#lifecycle-hooks)

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
import { SkillBase, SkillManifest, SkillToolRegistration } from '@signalwire/sdk';

class MySkill extends SkillBase {
  static override SKILL_NAME = 'my_skill';
  static override SKILL_VERSION = '1.0.0';
  static override SKILL_DESCRIPTION = 'Does something useful';
  static override REQUIRED_ENV_VARS = ['MY_API_KEY'] as const;
  static override SUPPORTS_MULTIPLE_INSTANCES = false;

  override getTools(): SkillToolDefinition[] {
    return [
      {
        name: 'my_tool',
        description: 'Performs the action',
        parameters: { query: { type: 'string', description: 'Input' } },
        handler: (args) => {
          return new FunctionResult(`Result for ${args.query}`);
        },
      },
    ];
  }

  override getHints(): string[] {
    return ['my skill', 'useful action'];
  }

  override getPromptSections(): SkillPromptSection[] {
    return [
      {
        title: 'My Skill',
        body: 'You have access to my_tool for performing useful actions.',
      },
    ];
  }

  override getGlobalData(): Record<string, unknown> {
    return { my_skill_enabled: true };
  }
}
```

### Key Methods

| Method | Returns | Purpose |
|---|---|---|
| `getTools()` | `SkillToolDefinition[]` | Define the SWAIG tools this skill provides |
| `getHints()` | `string[]` | Speech recognition hints for ASR accuracy |
| `getPromptSections()` | `SkillPromptSection[]` | Prompt text injected into the agent's system prompt |
| `getGlobalData()` | `Record<string, unknown>` | Key-value pairs merged into agent global data |
| `setup()` | `Promise<void>` | Async initialization (API connections, file loading) |
| `cleanup()` | `Promise<void>` | Cleanup on agent shutdown |

---

## SkillManager

Each `AgentBase` has an internal `SkillManager`. When you call `agent.addSkill()`, the manager:

1. Validates required environment variables from the skill manifest.
2. Calls `skill.setup()` for async initialization.
3. Registers all tools from `skill.registerTools()` with the agent.
4. Merges hints from `skill.getHints()` into the agent's hint list.
5. Adds prompt sections from `skill.getPromptSections()` to the POM.
6. Merges global data from `skill.getGlobalData()`.

```typescript
// SkillManager is used internally by AgentBase
const skills = agent.listSkills(); // Returns loaded skill metadata
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
```

Built-in skills are registered automatically by `registerBuiltinSkills()`. Custom skill classes must call `SkillRegistry.getInstance().register(cls)`:

```typescript
SkillRegistry.getInstance().register(MySkill);
```

---

## Tool Registration Flow

```
agent.addSkill(new WebSearchSkill({ max_results: 5 }))
  |
  v
SkillManager.addSkill(skill)
  |
  +-- validate env vars (GOOGLE_SEARCH_API_KEY, etc.)
  +-- skill.setup()          // async init
  +-- skill.getTools()       // get tool definitions
  |     |
  |     v
  +-- agent.defineTool(...)  // register each tool on the agent
  +-- agent.addHints(...)    // merge hints
  +-- agent.promptAddSection(...)  // add prompt text
  +-- agent.updateGlobalData(...)  // merge global data
```

---

## Creating a Custom Skill

1. **Extend `SkillBase`** and declare the static metadata fields:

```typescript
import { SkillBase, FunctionResult } from '@signalwire/sdk';

export class StockPriceSkill extends SkillBase {
  static override SKILL_NAME = 'stock_price';
  static override SKILL_VERSION = '1.0.0';
  static override SKILL_DESCRIPTION = 'Look up current stock prices';
  static override REQUIRED_ENV_VARS = ['STOCK_API_KEY'] as const;
  static override SUPPORTS_MULTIPLE_INSTANCES = false;

  private apiKey: string;

  constructor(config: Record<string, unknown> = {}) {
    super(config);
    this.apiKey = process.env['STOCK_API_KEY'] ?? '';
  }

  override getTools() {
    return [
      {
        name: 'get_stock_price',
        description: 'Get the current price of a stock by ticker symbol',
        parameters: {
          ticker: { type: 'string', description: 'Stock ticker symbol (e.g. AAPL)' },
        },
        handler: async (args: Record<string, unknown>) => {
          const ticker = String(args.ticker).toUpperCase();
          // In production, call a real stock API here
          return new FunctionResult(`${ticker} is currently trading at $150.25`);
        },
      },
    ];
  }

  override getHints() {
    return ['stock', 'ticker', 'price', 'market', 'shares'];
  }

  override getPromptSections() {
    return [
      {
        title: 'Stock Price Lookup',
        body: 'You can look up current stock prices using the get_stock_price tool. ' +
              'Ask the user for a ticker symbol if they want a price quote.',
      },
    ];
  }
}
```

2. **Register** the skill (optional, for name-based discovery):

```typescript
import { SkillRegistry } from '@signalwire/sdk';
SkillRegistry.getInstance().register(StockPriceSkill);
```

3. **Use** the skill:

```typescript
await agent.addSkill(new StockPriceSkill());
```

---

## Multi-Instance Skills

Some skills support multiple instances with different configurations. Set `static SUPPORTS_MULTIPLE_INSTANCES = true` and accept a `tool_name` config parameter:

```typescript
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

Skills declare required environment variables via the static `REQUIRED_ENV_VARS` field. The `SkillManager` checks these before calling `setup()`:

```typescript
export class MySkill extends SkillBase {
  static override SKILL_NAME = 'my_skill';
  static override SKILL_DESCRIPTION = 'Example skill with required env vars.';
  static override REQUIRED_ENV_VARS = ['GOOGLE_SEARCH_API_KEY', 'GOOGLE_SEARCH_CX'] as const;
  // ...
}
```

The skill is still added if env vars are missing; `skill.validateEnvVars()` returns the list of missing names so callers can surface the error.

---

## Parameter Schema Discovery

Skills can expose their configuration schema for tooling and documentation:

```typescript
// Get the parameter schema for a skill class
const schema = WebSearchSkill.getParameterSchema();
// => { max_results: { type: 'number', default: 5 }, safe_search: { type: 'string', ... } }
```

This allows external tools to generate configuration UIs or validate config objects before passing them to the skill constructor.

---

## Lifecycle Hooks

| Hook | When | Use Case |
|---|---|---|
| `constructor(config)` | Instantiation | Store config, set defaults |
| `setup()` | During `addSkill()` | Async init: connect to APIs, load data |
| `getTools()` | During `addSkill()` | Return tool definitions |
| `cleanup()` | Agent shutdown | Close connections, flush buffers |

All hooks are called by the `SkillManager` in the order shown above.
