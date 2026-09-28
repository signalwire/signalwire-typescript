# Third-Party Skills Integration Guide

This guide explains how to write a skill outside the SDK and load it into a SignalWire AI Agents TypeScript agent. You can register the class in code, publish it as an npm package, or have the registry import it from a directory.

For the full skills reference (built-in skills, lifecycle, registry API), see the
[Skills System Guide](skills-guide.md).

The examples on this page assume this shared context:

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module so top-level `await` is allowed
declare global {
  // Shared context the fragments on this page assume.
  const agent: import('@signalwire/sdk').AgentBase;
  const SkillBase: typeof import('@signalwire/sdk').SkillBase;
  const FunctionResult: typeof import('@signalwire/sdk').FunctionResult;
  // Illustrative third-party skill class defined in the first example on this page.
  const WeatherSkill: any;
}
```

## Overview

A third-party skill loads in one of three ways:

1. **Direct registration**: import the class and register it with `registerSkill()`, or pass an instance to `agent.addSkill()`.
2. **Directory discovery**: point the registry at a directory, and it imports the modules there and registers the skill classes they export.
3. **Environment variable**: list discovery directories in `SIGNALWIRE_SKILL_PATHS`.

Discovery (methods 2 and 3) runs the code of every module it imports, so it's off unless `SWML_SKILL_DISCOVERY_ENABLED` is `true`. A registered third-party skill appears in `listSkillsWithParams()` with its parameter schema, like a built-in one.

## Creating a Third-Party Skill

A third-party skill extends `SkillBase`, like the built-in skills. It sets its metadata as static fields, declares its parameters, implements `getTools()`, and can implement `setup()`, `_getPromptSections()`, `getHints()` and `getGlobalData()`. This skill reads its key from `api_key` or `WEATHER_API_KEY`:

```typescript
// my-weather-skill/skill.ts
import {
  SkillBase,
  FunctionResult,
  type SkillToolDefinition,
  type ParameterSchemaEntry,
} from '@signalwire/sdk';

export class WeatherSkill extends SkillBase {
  static override SKILL_NAME = 'weather';
  static override SKILL_DESCRIPTION = 'Get weather information for any location';
  static override SKILL_VERSION = '1.0.0';

  private apiKey?: string;
  private units = 'celsius';

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      api_key: {
        type: 'string',
        description: 'Weather API key',
        required: true,
        hidden: true,
        env_var: 'WEATHER_API_KEY',
      },
      units: {
        type: 'string',
        description: 'Temperature units',
        default: 'celsius',
        required: false,
        enum: ['celsius', 'fahrenheit', 'kelvin'],
      },
      cache_timeout: {
        type: 'integer',
        description: 'Cache timeout in seconds',
        default: 300,
        required: false,
        min: 0,
        max: 3600,
      },
    };
  }

  // Runs when the skill is added. Returning false refuses the skill.
  override async setup(): Promise<boolean> {
    this.apiKey = this.getConfig<string | undefined>('api_key') ?? process.env['WEATHER_API_KEY'];
    this.units = this.getConfig<string>('units', 'celsius');
    if (!this.apiKey) {
      this.logger.error('api_key or WEATHER_API_KEY is required');
      return false;
    }
    return true;
  }

  override getTools(): SkillToolDefinition[] {
    return [
      {
        name: 'get_weather',
        description: 'Get current weather for a location.',
        parameters: {
          location: { type: 'string', description: 'City name or coordinates' },
        },
        required: ['location'],
        handler: (args) => {
          const location = String(args.location ?? '').trim();
          if (!location) {
            return new FunctionResult('Ask the caller which location they want the weather for.');
          }
          // Call the weather API with this.apiKey here.
          const unit = this.units[0]!.toUpperCase();
          return new FunctionResult(`The weather in ${location} is sunny and 22 degrees ${unit}.`);
        },
      },
    ];
  }
}
```

The skill checks the key in `setup()` instead of listing `WEATHER_API_KEY` in `REQUIRED_ENV_VARS`. A variable in `REQUIRED_ENV_VARS` must be set even when the caller passes `api_key`, so the skill wouldn't load without it.

## Integration Methods

### Method 1: Direct Registration

Register the class with the global registry, then add it to any agent by name:

<!-- snippet: no-run illustrative fragment: references the assumed `WeatherSkill` class defined in the surrounding prose -->
```typescript
import { AgentBase, registerSkill } from '@signalwire/sdk';
// import { WeatherSkill } from './my-weather-skill/skill.js';

registerSkill(WeatherSkill);

const agent = new AgentBase({ name: 'my-agent' });
await agent.addSkillByName('weather', { api_key: 'your-api-key', units: 'fahrenheit' });
```

`registerSkill()` throws when the class has no `SKILL_NAME`, or when its schema is empty. When the name belongs to a built-in skill and `registerBuiltinSkills()` has run, the name is locked. The call then logs `Cannot overwrite locked skill` and keeps the built-in class, so choose a name no built-in skill uses.

You can also skip the registry and add an instance:

```typescript
await agent.addSkill(new WeatherSkill({ api_key: 'your-api-key', units: 'fahrenheit' }));
```

### Method 2: Directory Discovery

Discovery imports skill modules from a directory and registers the classes they export. Set `SWML_SKILL_DISCOVERY_ENABLED=true` before you use it, because without it, discovery logs a warning and registers nothing:

```bash
export SWML_SKILL_DISCOVERY_ENABLED=true
```

In the directory, discovery imports every `.ts` and `.js` file, and the `skill.ts` file of each subdirectory. It registers every exported class that extends `SkillBase` and sets `SKILL_NAME`. A module that exports only a factory function registers nothing. This example discovers the skills in one directory:

<!-- snippet: no-run needs a real directory of skill modules and SWML_SKILL_DISCOVERY_ENABLED=true -->
```typescript
import { SkillRegistry } from '@signalwire/sdk';

// Directory layout:
// /opt/custom-skills/
//   stock-market.js      exports class StockMarketSkill (SKILL_NAME 'stock_market')
//   weather/skill.ts     exports class WeatherSkill (SKILL_NAME 'weather')

const registry = SkillRegistry.getInstance();
const discovered = await registry.discoverFromDirectory('/opt/custom-skills');
console.log(discovered); // the SKILL_NAME of each class it registered

await agent.addSkillByName('weather', { api_key: process.env['WEATHER_API_KEY'] });
```

A module that fails to import is skipped, with a debug-level log entry. The top-level `addSkillDirectory(path)` adds a directory to the search paths that `discoverAll()` scans.

Discovery runs each module's code with your process's permissions. Point it only at directories that nobody else can write to.

### Method 3: Environment Variable

`SIGNALWIRE_SKILL_PATHS` holds colon-separated directories. The registry reads it once, when it's first created, and adds them to its search paths:

```bash
export SWML_SKILL_DISCOVERY_ENABLED=true

# One directory
export SIGNALWIRE_SKILL_PATHS=/opt/my-skills

# Several directories, separated by colons
export SIGNALWIRE_SKILL_PATHS=/opt/my-skills:/home/user/custom-skills
```

Nothing scans the paths for you. Call `discoverAll()`, which runs `discoverFromDirectory()` on each search path:

<!-- snippet: no-run needs real skill directories and SWML_SKILL_DISCOVERY_ENABLED=true -->
```typescript
import { SkillRegistry } from '@signalwire/sdk';

await SkillRegistry.getInstance().discoverAll();
await agent.addSkillByName('weather', { api_key: process.env['WEATHER_API_KEY'] });
```

## Skill Discovery and Schema

The top-level helpers list every registered skill, third-party ones included:

<!-- snippet: no-run illustrative fragment: references the assumed `WeatherSkill` class defined in the surrounding prose -->
```typescript
import { listSkills, listSkillsWithParams, registerSkill } from '@signalwire/sdk';

registerSkill(WeatherSkill);

// Metadata and schema for every registered skill, as an array
const skills = listSkills();

// The same entries, keyed by skill name
const allSkills = listSkillsWithParams();
console.log(allSkills['weather']?.parameters['units']);
```

The last line prints the `units` entry from the skill's schema:

```text
{
  type: 'string',
  description: 'Temperature units',
  default: 'celsius',
  required: false,
  enum: [ 'celsius', 'fahrenheit', 'kelvin' ]
}
```

Each entry also has `name`, `description`, `version`, `supportsMultipleInstances`, `requiredEnvVars` and `requiredPackages`.

## Best Practices

These practices help a skill work in other people's agents.

### 1. Skill Naming

Follow these rules for `SKILL_NAME`:

- Use lowercase words separated by underscores, such as `stock_market`.
- Choose a name no built-in skill uses. A locked built-in name can't be replaced.
- Keep tool names distinct too. When two skills register the same tool name, the one added later replaces the other's tool.

### 2. Parameter Design

Follow these rules for the parameter schema:

- Implement `getParameterSchema()` and spread `super.getParameterSchema()`.
- Mark keys and passwords as `hidden`.
- Give each optional parameter a default that works.
- When you declare an `env_var`, read that variable in your code. The schema only names it.

For the schema format, see [Skills Parameter Schema](skills_parameter_schema.md).

### 3. Error Handling

Check the configuration in `setup()`, and return `false` when the skill can't work. The agent then refuses the skill with an error, instead of offering the model a tool that fails:

<!-- snippet: no-compile illustrative bare method fragment (class body context) -->
```typescript
override async setup(): Promise<boolean> {
  this.apiKey = this.getConfig<string | undefined>('api_key') ?? process.env['MY_API_KEY'];
  if (!this.apiKey) {
    this.logger.error('api_key or MY_API_KEY is required');
    return false;
  }
  return true;
}
```

In a handler, return a result that tells the model what happened, instead of throwing:

<!-- snippet: no-compile illustrative tool-handler fragment (references skill instance `this`) -->
```typescript
// Inside a tool handler
handler: async (args) => {
  const url = `https://weather.example.com/current?q=${encodeURIComponent(String(args.location))}`;
  try {
    const response = await fetch(url);
    return new FunctionResult(await response.text());
  } catch {
    return new FunctionResult('The weather service is unavailable. Offer to try again later.');
  }
}
```

## Advanced Features

### Dynamic Tool Names

Read the tool name from the configuration, so an agent can name the tool for its own prompt. This `getTools()` does that:

<!-- snippet: no-compile illustrative bare method fragment (class body context) -->
```typescript
override getTools(): SkillToolDefinition[] {
  const toolName = this.getConfig<string>('tool_name', 'get_weather');
  const service = this.getConfig<string>('service', 'default');
  return [
    {
      name: toolName,
      description: `Get weather using ${service}`,
      parameters: {
        location: { type: 'string', description: 'City name or coordinates' },
      },
      required: ['location'],
      handler: (args) => this.handleWeather(args),
    },
  ];
}
```

To add the skill more than once with different tool names, also set `static SUPPORTS_MULTIPLE_INSTANCES = true`. The default instance key then includes `tool_name`.

### Skill Dependencies

A skill's `agent` property is set before `setup()` runs, so `setup()` can check for another skill. The other skill must be added first:

<!-- snippet: no-compile illustrative bare method fragment (class body context) -->
```typescript
override async setup(): Promise<boolean> {
  if (!this.agent?.hasSkill('translation')) {
    this.logger.error('Add the translation skill before this one');
    return false;
  }
  return true;
}
```

## Testing Third-Party Skills

Test a skill with [Vitest](https://vitest.dev/) before you publish it. This test registers the skill, adds it to an agent and checks its schema:

<!-- snippet: no-compile Vitest test file (imports a local skill module + uses vitest globals) -->
```typescript
// tests/weather-skill.test.ts
import { AgentBase, registerSkill } from '@signalwire/sdk';
import { WeatherSkill } from '../my-weather-skill/skill.js';

describe('WeatherSkill', () => {
  it('registers and adds to an agent', async () => {
    registerSkill(WeatherSkill);
    const agent = new AgentBase({ name: 'test-agent' });
    await agent.addSkillByName('weather', { api_key: 'test-key' });
    expect(agent.hasSkill('weather')).toBe(true);
  });

  it('declares a parameter schema', () => {
    const schema = WeatherSkill.getParameterSchema();
    expect(schema['api_key']?.required).toBe(true);
    expect(schema['api_key']?.hidden).toBe(true);
  });
});
```

To call a tool without a server, run the `swaig-test` CLI on an agent file that adds the skill. These commands list the agent's tools, then call `get_weather`:

```bash
npx swaig-test my-agent.ts --list-tools
npx swaig-test my-agent.ts --exec get_weather --location "San Francisco"
```

Everything after `--exec get_weather` is an argument to the function, so put any of the CLI's own options before `--exec`. For the options, see the [CLI Guide](cli-guide.md).

## Troubleshooting

### Skill Not Found

`addSkillByName()` rejects with `skill not found in registry` when the name isn't registered. Check these causes in order:

1. For discovery, `SWML_SKILL_DISCOVERY_ENABLED` must be `true`. Without it, the registry logs `Skill directory discovery is disabled`.
2. Discovery must run: call `discoverFromDirectory()` or `discoverAll()`, or register the class with `registerSkill()`.
3. The module must export the class itself, not only a factory, and the class must set `SKILL_NAME`.
4. A class in a subdirectory must be in `skill.ts`. Other files in a subdirectory aren't imported.
5. The name you pass to `addSkillByName()` must equal `SKILL_NAME`.
6. A module that fails to import is skipped with a debug-level log entry. Set `SIGNALWIRE_LOG_LEVEL=debug` to see it.

This check prints the search paths and the registered names:

```typescript
import { SkillRegistry } from '@signalwire/sdk';

const registry = SkillRegistry.getInstance();
console.log('Search paths:', registry.getSearchPaths());
console.log('Registered skills:', registry.listRegistered());
```

### Skill Not Loaded

When the name is registered but `addSkill()` or `addSkillByName()` still rejects, the error names the cause:

- `missing environment variables`: a variable in `REQUIRED_ENV_VARS` isn't set.
- `missing required packages`: a package in `REQUIRED_PACKAGES` doesn't import.
- `Failed to setup skill`: `setup()` returned `false`. The skill's own log entry says why.
- `already loaded and does not support multiple instances`: the skill was added twice.

## Distributing a Skill Package

Publish the skill as an npm package that exports the skill class. Consumers import it and register it:

<!-- snippet: no-compile imports an illustrative third-party npm package that is not installed -->
```typescript
import { AgentBase, registerSkill } from '@signalwire/sdk';
import { WeatherSkill } from 'my-signalwire-skills';

registerSkill(WeatherSkill);

const agent = new AgentBase({ name: 'my-agent' });
await agent.addSkillByName('weather', { api_key: process.env['WEATHER_API_KEY'] });
await agent.run();
```

Declare `@signalwire/sdk` as a peer dependency of the package, so the skill extends the same `SkillBase` class the consumer's agent uses. Directory discovery registers only a class that extends that `SkillBase`, and a copy of the SDK in the skill package's own `node_modules` is a different class.
