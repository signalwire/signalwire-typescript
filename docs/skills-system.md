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
        handler: (args) => {
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
| `registerTools()` | `SkillToolRegistration[]` | Define the SWAIG tools this skill provides |
| `getHints()` | `string[]` | Speech recognition hints for ASR accuracy |
| `getPromptSections()` | Section array | Prompt text injected into the agent's system prompt |
| `getGlobalData()` | `Record<string, unknown>` | Key-value pairs merged into agent global data |
| `setup()` | `Promise<void>` | Async initialization (API connections, file loading) |
| `teardown()` | `Promise<void>` | Cleanup on agent shutdown |

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

## Creating a Custom Skill

1. **Extend `SkillBase`** and declare a static `manifest`:

```typescript
import { SkillBase, FunctionResult } from '@signalwire/sdk';

export class StockPriceSkill extends SkillBase {
  static manifest = {
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

  registerTools() {
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

  getHints() {
    return ['stock', 'ticker', 'price', 'market', 'shares'];
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
}
```

2. **Register** the skill (optional, for name-based discovery):

```typescript
import { SkillRegistry } from '@signalwire/sdk';
SkillRegistry.register('stock_price', (config) => new StockPriceSkill(config));
```

3. **Use** the skill:

```typescript
await agent.addSkill(new StockPriceSkill());
```

---

## Multi-Instance Skills

Some skills support multiple instances with different configurations. Set `supportsMultipleInstances: true` in the manifest and accept a `tool_name` config parameter:

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

Skills declare required environment variables in their manifest. The `SkillManager` checks these before calling `setup()`:

```typescript
static manifest = {
  // ...
  requiredEnvVars: ['GOOGLE_SEARCH_API_KEY', 'GOOGLE_SEARCH_CX'],
};
```

If any required variable is missing, `addSkill()` throws with a descriptive error message listing the missing variables.

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
| `registerTools()` | During `addSkill()` | Return tool definitions |
| `teardown()` | Agent shutdown | Close connections, flush buffers |

All hooks are called by the `SkillManager` in the order shown above.
