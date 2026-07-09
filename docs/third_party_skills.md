# Third-Party Skills Integration Guide

This guide explains how to create and integrate third-party skills with the SignalWire AI Agents TypeScript SDK. The SDK supports multiple ways to load external skills, making it easy to extend agent capabilities without modifying the core SDK.

For the full skills reference (built-in skills, lifecycle, registry API), see the
[Skills System Guide](skills-guide.md).

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module so top-level `await` is allowed
declare global {
  // Shared context the fragments below assume (constructed in prose examples above).
  const agent: import('@signalwire/sdk').AgentBase;
  const SkillBase: typeof import('@signalwire/sdk').SkillBase;
  const FunctionResult: typeof import('@signalwire/sdk').FunctionResult;
  // Illustrative third-party skill class defined in the prose examples above.
  const WeatherSkill: any;
  // Node globals (tsconfig sets types:[], so declare them here).
  var process: { env: Record<string, string | undefined>; [k: string]: any };
}
```

## Overview

Third-party skills can be integrated using three approaches:

1. **Direct Registration** - Register skill classes programmatically with `registerSkill()`.
2. **Directory Discovery** - Point the registry at directories containing skill modules.
3. **Environment Variables** - Configure skill search paths via `SIGNALWIRE_SKILL_PATHS`.

All third-party skills are discovered and indexed the same way as built-in skills, appearing in `listSkillsWithParams()` output with their parameter schemas.

## Creating a Third-Party Skill

Third-party skills extend `SkillBase`, exactly like the built-in skills. A skill declares
its metadata as static fields, implements `getTools()`, and optionally implements
`setup()`, `getPromptSections()`, `getHints()`, and `getGlobalData()`. Export a
`createSkill` factory so the registry can discover it from disk.

```typescript
// my-weather-skill/skill.ts
import {
  SkillBase,
  FunctionResult,
  type SkillToolDefinition,
  type SkillConfig,
  type ParameterSchemaEntry,
} from '@signalwire/sdk';

export class WeatherSkill extends SkillBase {
  static override SKILL_NAME = 'weather';
  static override SKILL_DESCRIPTION = 'Get weather information for any location';
  static override SKILL_VERSION = '1.0.0';
  static override REQUIRED_ENV_VARS = ['WEATHER_API_KEY'] as const;

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

  // Async initialization called when the skill is added to an agent.
  // Return true on success; return false to signal setup failed.
  override async setup(): Promise<boolean> {
    this.apiKey = this.getConfig<string>('api_key', '') || process.env['WEATHER_API_KEY'];
    this.units = this.getConfig<string>('units', 'celsius');
    if (!this.apiKey) {
      this.logger.warn('Weather API key is required');
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
            return new FunctionResult('Please provide a location.');
          }
          // Implementation would call the weather API here.
          const unit = this.units[0].toUpperCase();
          return new FunctionResult(`The weather in ${location} is sunny and 22°${unit}.`);
        },
      },
    ];
  }
}

// Factory function (required for directory-based discovery)
export function createSkill(config?: SkillConfig): WeatherSkill {
  return new WeatherSkill(config);
}
```

## Integration Methods

### Method 1: Direct Registration

Register the skill class with the global registry, then add it to any agent by name:

<!-- snippet: no-run illustrative fragment: references the assumed `WeatherSkill` class defined in the surrounding prose -->
```typescript
import { AgentBase, registerSkill } from '@signalwire/sdk';
// import { WeatherSkill } from './my-weather-skill/skill.js';

// Register the skill globally
registerSkill(WeatherSkill);

// Add it to an agent by name (async)
const agent = new AgentBase({ name: 'my-agent' });
await agent.addSkillByName('weather', { api_key: 'your-api-key', units: 'fahrenheit' });
```

You can also skip the registry and add an instance directly:

```typescript
await agent.addSkill(new WeatherSkill({ api_key: 'your-api-key', units: 'fahrenheit' }));
```

### Method 2: Directory Discovery

Register one or more directories of skill modules, then discover them:

```typescript
import { SkillRegistry, addSkillDirectory } from '@signalwire/sdk';

// Add a directory of custom skills to the search paths
addSkillDirectory('/opt/custom-skills');

// Directory layout (each module exports `createSkill` or a default SkillBase subclass):
// /opt/custom-skills/
//   weather.js        // exports createSkill -> WeatherSkill
//   stock-market.js   // exports createSkill -> StockMarketSkill
//   translation.js    // exports createSkill -> TranslationSkill

// Discover and register skills from the configured search paths
const registry = SkillRegistry.getInstance();
const discovered = await registry.discoverFromDirectory('/opt/custom-skills');
// discovered: ['weather', 'stock_market', 'translation']

// Now add them to an agent by name
await agent.addSkillByName('weather', { api_key: '...' });
await agent.addSkillByName('stock_market', { api_key: '...' });
```

Discovery looks for modules that export either:
- A `createSkill` factory function, or
- A default export that is a `SkillBase` subclass.

### Method 3: Environment Variable

Set `SIGNALWIRE_SKILL_PATHS` (colon-separated) to add search paths automatically:

```bash
# Single directory
export SIGNALWIRE_SKILL_PATHS=/opt/my-skills

# Multiple directories (colon-separated)
export SIGNALWIRE_SKILL_PATHS=/opt/my-skills:/home/user/custom-skills
```

```typescript
import { SkillRegistry } from '@signalwire/sdk';

// discoverAll() scans every configured search path, including those from
// SIGNALWIRE_SKILL_PATHS
const registry = SkillRegistry.getInstance();
await registry.discoverAll();

await agent.addSkillByName('weather', { api_key: '...' });
```

## Skill Discovery and Schema

Third-party skills are fully integrated with the SDK's discovery system. Use the top-level
helpers to enumerate registered skills:

```typescript
import { listSkills, listSkillsWithParams } from '@signalwire/sdk';

// Lightweight metadata for all registered skills
const skills = listSkills();

// Full schema for all skills, keyed by name
const allSkills = listSkillsWithParams();
console.log(allSkills['weather']);
// {
//   name: 'weather',
//   description: 'Get weather information for any location',
//   version: '1.0.0',
//   parameters: {
//     api_key:  { type: 'string', required: true, hidden: true, env_var: 'WEATHER_API_KEY' },
//     units:    { type: 'string', default: 'celsius', enum: ['celsius', 'fahrenheit', 'kelvin'] },
//     ...
//   },
// }
```

## Best Practices

### 1. Skill Naming

- Use lowercase, underscore-separated names (e.g. `stock_market`).
- Choose unique names to avoid conflicts with built-in skills.
- Match the module file name to `SKILL_NAME` for directory-based discovery.

### 2. Parameter Design

- Always implement `getParameterSchema()` for GUI compatibility.
- Mark sensitive parameters as `hidden`.
- Provide sensible defaults.
- Use `env_var` for parameters that can come from the environment.

### 3. Error Handling

Validate configuration in `setup()` and return user-friendly errors at call time:

<!-- snippet: no-compile illustrative bare method fragment (class body context) -->
```typescript
override async setup(): Promise<boolean> {
  this.apiKey = this.getConfig<string>('api_key', '') || process.env['MY_API_KEY'];
  if (!this.apiKey) {
    this.logger.warn('API key is required; the tool will return a configuration error at call time');
  }
  return true;
}
```

<!-- snippet: no-compile illustrative tool-handler fragment (references skill instance `this`) -->
```typescript
// Inside a tool handler
handler: (args) => {
  if (!this.apiKey) {
    return new FunctionResult('This skill is not configured. Set MY_API_KEY.');
  }
  // ...
}
```

## Advanced Features

### Dynamic Tool Names

Customize tool names from config for clearer agent prompts:

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

### Skill Dependencies

Check whether a required skill is present before completing setup:

<!-- snippet: no-compile illustrative bare method fragment (class body context) -->
```typescript
override async setup(): Promise<boolean> {
  if (this.agent && !this.agent.hasSkill('translation')) {
    this.logger.error('This skill requires the translation skill');
    return false;
  }
  return true;
}
```

## Testing Third-Party Skills

Test your skills with [Vitest](https://vitest.dev/) before distribution:

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
    expect(schema.api_key.required).toBe(true);
    expect(schema.api_key.hidden).toBe(true);
  });
});
```

You can also exercise a skill's tools without a server using the `swaig-test` CLI:

```bash
npx tsx src/cli/swaig-test.ts examples/my-agent.ts --list-tools
npx tsx src/cli/swaig-test.ts examples/my-agent.ts --exec get_weather --location "San Francisco"
```

## Troubleshooting

### Skill Not Found

If your skill isn't being discovered:

1. Check the directory layout and that the file exports `createSkill` (or a default `SkillBase` subclass).
2. Verify `SKILL_NAME` is unique and matches the name you pass to `addSkillByName()`.
3. Ensure you called `discoverFromDirectory()` / `discoverAll()` (or `registerSkill()`).
4. Check the logs for loading errors.

### Environment Variables

Verify the search paths the registry is using:

```typescript
console.log('Skill paths:', process.env['SIGNALWIRE_SKILL_PATHS'] ?? 'Not set');
```

## Distributing a Skill Package

Publish your skill as an npm package that exports the skill class and `createSkill`
factory. Consumers register it directly:

<!-- snippet: no-compile imports an illustrative third-party npm package that is not installed -->
```typescript
import { AgentBase, registerSkill } from '@signalwire/sdk';
import { WeatherSkill } from 'my-signalwire-skills';

registerSkill(WeatherSkill);

const agent = new AgentBase({ name: 'my-agent' });
await agent.addSkillByName('weather', { api_key: '...' });
await agent.run();
```
