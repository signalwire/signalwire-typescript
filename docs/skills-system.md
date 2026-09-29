# Skills System Reference

This page describes how the skills system in the SignalWire AI Agents TypeScript SDK is put together. It covers the classes, the order in which they run, and the security controls around loading code.

> **See also:** [skills-guide.md](skills-guide.md) for usage, the built-in skills and their parameters.

The examples on this page assume this shared context:

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module so top-level `await` is allowed
declare global {
  // Shared context the fragments on this page assume.
  const agent: import('@signalwire/sdk').AgentBase;
  const SkillBase: typeof import('@signalwire/sdk').SkillBase;
  const SkillRegistry: typeof import('@signalwire/sdk').SkillRegistry;
  const FunctionResult: typeof import('@signalwire/sdk').FunctionResult;
  // Illustrative custom skill classes referenced by the registry and usage examples.
  // `any` because they are used both as a value to `register(...)` and constructed
  // with `new`; the concrete subclass is defined in the examples on this page.
  const MySkill: any;
  const StockPriceSkill: any;
  // Real built-in skill classes referenced by the multi-instance and schema examples.
  const DataSphereSkill: typeof import('@signalwire/sdk').DataSphereSkill;
  const WebSearchSkill: typeof import('@signalwire/sdk').WebSearchSkill;
}
```

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
11. [Security Controls](#security-controls)

---

## Architecture

Three classes make up the skills system. The registry is shared by the whole process, and each agent has its own manager:

```text
SkillRegistry (one per process)
   |
   +-- maps skill names to SkillBase subclasses
   |
   +-- create(name, config) --> SkillBase instance
                                   |
AgentBase.addSkill(instance) ------+
   |
   +-- SkillManager (one per agent): checks the skill, runs setup()
   |
   +-- AgentBase: registers the skill's tools, prompt sections, hints and global data
```

Each class has one job:

| Component | Responsibility |
|---|---|
| **SkillBase** | Abstract base class every skill extends. Declares tools, prompt sections, hints, global data and the parameter schema. |
| **SkillManager** | One per `AgentBase`. Checks a skill, runs its `setup()`, and tracks the loaded instances. |
| **SkillRegistry** | Process-wide singleton. Maps skill names to skill classes for `agent.addSkillByName()`. |

---

## SkillBase

Every skill extends `SkillBase`. A skill sets `SKILL_NAME` and `SKILL_DESCRIPTION`, and the constructor throws when either is empty. This skill uses the main hooks:

```typescript
import {
  SkillBase,
  FunctionResult,
  type SkillToolDefinition,
  type SkillPromptSection,
} from '@signalwire/sdk';

class MySkill extends SkillBase {
  static override SKILL_NAME = 'my_skill';
  static override SKILL_VERSION = '1.0.0';
  static override SKILL_DESCRIPTION = 'Looks up account balances';
  static override REQUIRED_ENV_VARS = ['MY_API_KEY'] as const;
  static override SUPPORTS_MULTIPLE_INSTANCES = false;

  override getTools(): SkillToolDefinition[] {
    return [
      {
        name: 'get_balance',
        description: 'Get the balance of an account',
        parameters: { account: { type: 'string', description: 'Account number' } },
        handler: (args: Record<string, unknown>) => {
          return new FunctionResult(`Balance for account ${String(args.account)}: 42.00 USD`);
        },
      },
    ];
  }

  override getHints(): string[] {
    return ['balance', 'account'];
  }

  protected override _getPromptSections(): SkillPromptSection[] {
    return [
      {
        title: 'Account Balances',
        body: 'Use get_balance when the caller asks for an account balance.',
      },
    ];
  }

  override getGlobalData(): Record<string, unknown> {
    return { balances_enabled: true };
  }
}
```

### Key Methods

A skill overrides these methods:

| Method | Returns | Purpose |
|---|---|---|
| `getTools()` | `SkillToolDefinition[]` | The SWAIG tools the skill provides. The default returns the tools added with the protected `defineTool()`. |
| `getDataMapTools()` | `Record<string, unknown>[]` | Complete SWAIG function objects, such as the output of `DataMap.toSwaigFunction()` |
| `getHints()` | `string[]` | Speech recognition hints |
| `_getPromptSections()` | `SkillPromptSection[]` | Prompt sections. The public `getPromptSections()` returns them unless `skip_prompt` is `true`. |
| `getGlobalData()` | `Record<string, unknown>` | Keys merged into the agent's global data |
| `setup()` | `Promise<boolean>` | Async initialization. Return `false` to refuse the skill. |
| `cleanup()` | `Promise<void>` | Async teardown when the skill is removed |
| `getInstanceKey()` | `string` | Key that tells instances apart on one agent |

For the full list of members and helpers, see [SkillBase Members Reference](skills-guide.md#skillbase-members-reference).

---

## SkillManager

Each `AgentBase` has a `SkillManager`, available as `agent.skillManager`. When you call `agent.addSkill()`, the agent sets the skill's `agent` property and passes the skill to the manager. The manager checks it in this order, and throws at the first failure:

1. A single-instance skill whose instance key is already loaded is refused. A multi-instance skill with a duplicate key is skipped with a warning.
2. Every variable in `REQUIRED_ENV_VARS` must be set.
3. `getParameterSchema()` must return a non-empty object.
4. Every package in `REQUIRED_PACKAGES` must import.
5. `setup()` must return `true`.

The manager then marks the skill initialized and records it. `AgentBase.addSkill()` registers the skill's tools, prompt sections, hints and global data on the agent.

These `SkillManager` methods are public:

| Method | Description |
|---|---|
| `addSkill(skill)` | Runs the checks and `setup()`, and records the skill. Throws on failure. |
| `loadSkill(SkillClass, config?)` | Constructs and adds a skill. On `agent.skillManager`, it also registers the skill on the agent, as `agent.addSkill()` does. Resolves to `[true, '']`, or `[false, message]` instead of throwing. |
| `loadSkillByName(name, config?)` | The same, looking the class up in the registry |
| `removeSkill(keyOrId)` | Calls `cleanup()` and removes one skill, by instance key or `instanceId` |
| `removeSkillByName(name)` | Removes every instance with that name, and resolves to how many it removed |
| `hasSkill(name)` / `hasSkillByKey(key)` | Whether a skill with that name, or that instance key, is loaded |
| `getSkill(keyOrId)` | The loaded instance, or `undefined` |
| `listSkills()` | Name, `instanceId` and initialization state of each loaded skill |
| `listSkillKeys()` | Instance keys of the loaded skills |
| `loadedSkills` | Read-only map of instance key to skill |
| `clear()` | Calls `cleanup()` on every loaded skill and removes them all |

`loadSkill()` and `loadSkillByName()` on `agent.skillManager` go through `agent.addSkill()`, so the skill's tools, prompt sections, hints and global data reach the agent, as with Python's `load_skill()`. `addSkill()` on the manager only checks, sets up and records the skill, and a standalone `new SkillManager()` has no agent to register on. This example lists what's loaded:

```typescript
const skills = agent.listSkills(); // same as agent.skillManager.listSkills()
```

A per-request copy of the agent, made for a dynamic config callback or `addPerCallConfig()`, starts with the skills the agent has loaded. It shares the instances without running `setup()` again. Adding one of those instances to the copy does nothing, and removing it from the copy doesn't call `cleanup()`.

---

## SkillRegistry

The registry is a process-wide singleton that maps each skill's `SKILL_NAME` to its class. This example reads what's registered:

```typescript
import { SkillRegistry } from '@signalwire/sdk';

const registry = SkillRegistry.getInstance();

// Metadata and parameter schema for every registered skill
const available = registry.listSkills();

// One skill's metadata and schema, or undefined
const schema = registry.getSkillSchema('web_search');
```

The registry starts empty. `registerBuiltinSkills()` registers the built-in skills. A custom class is registered with `register()`, or with the top-level `registerSkill()`, which calls it:

<!-- snippet: no-run illustrative fragment: references the assumed `SkillRegistry` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
SkillRegistry.getInstance().register(MySkill);
```

`register()` throws when the class has no `SKILL_NAME`, or when its `getParameterSchema()` throws or returns an empty object. When the name is locked, it logs a warning and keeps the registered class. When the name is registered but not locked, it replaces the class and logs a warning.

These registry methods are public:

| Method | Description |
|---|---|
| `getInstance()` / `resetInstance()` | Get the singleton, or drop it (for tests) |
| `register(SkillClass)` | Register a class under its `SKILL_NAME` |
| `lock(names?)` | Stop `register()` from replacing these names, or every registered name when called with none |
| `unregister(name)` / `clear()` | Remove one registration, or all of them. Locks don't prevent either. |
| `create(name, config?)` | Construct a registered skill, or return `null` |
| `getSkillClass(name)` / `has(name)` | Look up a class, or check that a name is registered |
| `listRegistered()` | Registered names |
| `listSkills()` / `getSkillSchema(name)` / `getAllSkillsSchema()` | Metadata and parameter schemas |
| `addSearchPath(path)` / `getSearchPaths()` | Directories for `discoverAll()` |
| `discoverFromDirectory(path)` / `discoverAll()` | Import skill modules and register their classes. Off unless `SWML_SKILL_DISCOVERY_ENABLED` is `true`. |
| `size` | Number of registered skills |

`addSkillDirectory(path)` on the registry checks that the path is a directory, throws if it isn't, and records it in `getExternalPaths()`. `discoverAll()` scans those directories as well as the search paths. The top-level `addSkillDirectory()` function calls `addSearchPath()`, which doesn't check the path.

The top-level functions `listSkills()`, `listSkillsWithParams()`, `registerSkill()` and `addSkillDirectory()` call the singleton.

---

## Tool Registration Flow

This is what happens for one `addSkill()` call:

```text
agent.addSkill(new WebSearchSkill({ num_results: 5 }))
  |
  +-- skill.setAgent(agent)
  +-- SkillManager.addSkill(skill)
  |     +-- instance key check
  |     +-- REQUIRED_ENV_VARS check
  |     +-- parameter schema check
  |     +-- REQUIRED_PACKAGES check (cheerio)
  |     +-- await skill.setup()          // web_search: are the credentials present?
  |     +-- skill.markInitialized()
  |
  +-- agent.defineTool(...)             // each tool from getTools(), plus swaig_fields
  +-- agent.registerSwaigFunction(...)  // each object from getDataMapTools()
  +-- agent.promptAddSection(...)       // each section from getPromptSections()
  +-- agent.addHints(...)               // getHints()
  +-- agent.updateGlobalData(...)       // getGlobalData()
```

---

## Creating a Custom Skill

Follow these steps to write, register and use a skill:

1. **Extend `SkillBase`** and set the static metadata fields:

```typescript
import {
  SkillBase,
  FunctionResult,
  type SkillToolDefinition,
  type SkillPromptSection,
} from '@signalwire/sdk';

export class StockPriceSkill extends SkillBase {
  static override SKILL_NAME = 'stock_price';
  static override SKILL_VERSION = '1.0.0';
  static override SKILL_DESCRIPTION = 'Look up current stock prices';
  static override REQUIRED_ENV_VARS = ['STOCK_API_KEY'] as const;

  override getTools(): SkillToolDefinition[] {
    return [
      {
        name: 'get_stock_price',
        description: 'Get the current price of a stock by ticker symbol',
        parameters: {
          ticker: { type: 'string', description: 'Stock ticker symbol, such as AAPL' },
        },
        required: ['ticker'],
        handler: async (args: Record<string, unknown>) => {
          const ticker = String(args.ticker ?? '').toUpperCase();
          // Call your market data API with process.env['STOCK_API_KEY'] here.
          const price = '150.25';
          return new FunctionResult(`${ticker} last traded at ${price} USD.`);
        },
      },
    ];
  }

  override getHints(): string[] {
    return ['stock', 'ticker', 'price', 'shares'];
  }

  protected override _getPromptSections(): SkillPromptSection[] {
    return [
      {
        title: 'Stock Price Lookup',
        body:
          'Use get_stock_price to look up a stock price. ' +
          'Ask the caller for a ticker symbol if they don\'t give one.',
      },
    ];
  }
}
```

2. **Register** the class, if you want to add it by name:

<!-- snippet: no-run illustrative fragment: references the assumed `StockPriceSkill` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
import { SkillRegistry } from '@signalwire/sdk';
SkillRegistry.getInstance().register(StockPriceSkill);
```

3. **Add** the skill to an agent:

```typescript
await agent.addSkill(new StockPriceSkill());
```

With `STOCK_API_KEY` unset, the call in step 3 rejects and the skill isn't added.

---

## Multi-Instance Skills

A skill class that sets `static SUPPORTS_MULTIPLE_INSTANCES = true` can be added more than once. The base schema then includes `tool_name`, and the default instance key is `<SKILL_NAME>_<tool_name>`. This example adds two DataSphere searches, each with its own tool:

<!-- snippet: no-run needs SignalWire credentials to load -->
```typescript
await agent.addSkill(new DataSphereSkill({ document_id: 'drinks-doc', tool_name: 'search_drinks' }));
await agent.addSkill(new DataSphereSkill({ document_id: 'food-doc', tool_name: 'search_food' }));
```

Each instance registers its tool under its `tool_name`, so the two don't collide. A skill whose tool names come from other settings overrides `getInstanceKey()`. For example, `info_gatherer` keys instances by `prefix`, and `web_search` by search engine ID and tool name.

---

## Environment Validation

A skill lists the environment variables it needs in the static `REQUIRED_ENV_VARS`. The manager checks them before it calls `setup()`:

```typescript
import { SkillBase, type SkillToolDefinition } from '@signalwire/sdk';

export class MySearchSkill extends SkillBase {
  static override SKILL_NAME = 'my_search';
  static override SKILL_DESCRIPTION = 'Example skill with required env vars.';
  static override REQUIRED_ENV_VARS = ['SEARCH_API_KEY', 'SEARCH_ENGINE_ID'] as const;

  override getTools(): SkillToolDefinition[] {
    return [];
  }
}
```

When a variable is missing, `addSkill()` rejects with `Cannot load skill '<name>': missing environment variables: <names>`, and the skill isn't added. `skill.validateEnvVars()` returns the missing names without loading anything.

---

## Parameter Schema Discovery

Every skill class exposes its parameters through the static `getParameterSchema()`:

```typescript
const schema = WebSearchSkill.getParameterSchema();
console.log(schema['num_results']);
// { type: 'integer', description: 'Number of high-quality results to return',
//   default: 3, required: false, min: 1, max: 10 }
```

A tool can use the schema to build a configuration form or check a configuration before it constructs the skill. The SDK itself doesn't check a configuration against the schema. For the format, see [Skills Parameter Schema](skills_parameter_schema.md).

---

## Lifecycle Hooks

The hooks run in this order:

| Hook | When | Use Case |
|---|---|---|
| `constructor(config)` | You construct the skill | Store the configuration. The base constructor moves `swaig_fields` out of it. |
| `setup()` | During `addSkill()`, after the checks | Async initialization: connect to APIs, load data, check settings |
| `getTools()`, `getDataMapTools()`, `getPromptSections()`, `getHints()`, `getGlobalData()` | During `addSkill()`, after `setup()` | Return what the agent registers |
| `cleanup()` | During `removeSkill()` or `SkillManager.clear()` | Close connections, release resources |

The agent doesn't call `cleanup()` when it shuts down. Removing a skill doesn't unregister the tools, prompt sections, hints or global data it already added.

---

## Security Controls

Three settings control whether the skills system runs code you didn't write in your agent.

- **Directory discovery** (`SWML_SKILL_DISCOVERY_ENABLED`): `discoverFromDirectory()` and `discoverAll()` import every `.ts` and `.js` module in a directory, which runs that module's code with your process's permissions. They do nothing, and log a warning, unless the variable is `true`. When you enable it, only point discovery at directories that nobody else can write to.
- **Registry lock** (`lock()`): `registerBuiltinSkills()` locks every registered name when it finishes. A later `register()` for a locked name, from your code or from a discovered module, logs `Cannot overwrite locked skill` and changes nothing. The lock doesn't stop `unregister()` or `clear()`, and it doesn't stop a discovered module from running code when it's imported.
- **Custom handler code** (`SWML_ALLOW_CUSTOM_HANDLER_CODE`): the `custom_skills` skill compiles each tool's `handler_code` string with the `Function` constructor only when the variable is `true`. The code isn't sandboxed. Without the variable, the tools register but return an error message instead of running the code.

Two built-in skills have their own switches. `claude_skills` runs shell commands from SKILL.md files only with `allow_shell_injection: true`. `mcp_gateway` skips TLS certificate checks only with both `verify_ssl: false` and `allow_insecure_tls: true`.

`spider` and `web_search` fetch URLs that a caller or the model supplied. They refuse private and internal addresses, check every redirect, and connect only to an address they checked. `native_vector_search` and `mcp_gateway` check their configured server URL once, at setup. `SWML_ALLOW_PRIVATE_URLS` turns these address checks off. For the related settings, see [Configuration](configuration.md) and [Security](security.md).
