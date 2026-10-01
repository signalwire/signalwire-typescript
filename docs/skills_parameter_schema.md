# Skills Parameter Schema System

Every skill in the SignalWire AI Agents TypeScript SDK describes its configuration parameters in a schema. This guide explains how to read the schemas of registered skills and how to declare one for your own skill.

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module so top-level `await` is allowed
```

## Overview

A skill's static `getParameterSchema()` returns one entry per parameter, with its type, description, default and a few hints. Tools can use the schema for these tasks:

- **Configuration forms**: build a form field for each parameter
- **Documentation**: list every parameter with its default
- **Pre-flight checks**: check a configuration before you construct the skill
- **Secret handling**: mark a parameter as secret, so a form can mask it
- **Environment variables**: name the variable a configuration tool can fill a value in from

The schema is a description. The SDK checks only that it's a non-empty object, when the skill is registered or added. It doesn't check a configuration against it. A missing `required` parameter, a wrong type or an out-of-range value is caught only if the skill's own `setup()` checks it. `hidden` and `env_var` are hints for tools. They don't hide a value or read a variable themselves.

## Using the Schema System

### Getting All Skills Schema

`listSkillsWithParams()` returns the schema of every skill in the global `SkillRegistry`, keyed by skill name. The registry starts empty, so call `registerBuiltinSkills()` first to include the built-in skills:

```typescript
import { listSkillsWithParams, registerBuiltinSkills } from '@signalwire/sdk';

registerBuiltinSkills();
const schema = listSkillsWithParams();
console.log(JSON.stringify(schema['datetime'], null, 2));
```

The script printed this entry for `datetime`, which has only the two base parameters:

```json
{
  "name": "datetime",
  "description": "Get current date, time, and timezone information",
  "version": "1.0.0",
  "supportsMultipleInstances": false,
  "requiredEnvVars": [],
  "requiredPackages": [],
  "parameters": {
    "swaig_fields": {
      "type": "object",
      "description": "Additional SWAIG fields to merge into each tool definition provided by this skill.",
      "default": {},
      "required": false
    },
    "skip_prompt": {
      "type": "boolean",
      "description": "When true, suppress all prompt sections from this skill.",
      "default": false,
      "required": false
    }
  }
}
```

The `web_search` entry has more parameters. These are two of them, from the same run:

```json
{
  "api_key": {
    "type": "string",
    "description": "Google Custom Search API key",
    "required": true,
    "hidden": true,
    "env_var": "GOOGLE_SEARCH_API_KEY"
  },
  "num_results": {
    "type": "integer",
    "description": "Number of high-quality results to return",
    "default": 3,
    "required": false,
    "min": 1,
    "max": 10
  }
}
```

`SkillRegistry.getInstance().getSkillSchema(name)` returns one skill's entry, and `listSkills()` returns the same entries as an array.

### Using Schema for GUI Configuration

This example builds an HTML form from the `web_search` schema. It masks `hidden` fields and shows the `env_var` hint:

```typescript
import { listSkillsWithParams, registerBuiltinSkills, type ParameterSchemaEntry } from '@signalwire/sdk';

registerBuiltinSkills();

const schema = listSkillsWithParams();
const webSearchSchema = schema['web_search'];

function generateFormField(paramName: string, paramInfo: ParameterSchemaEntry): string {
  let html = `<div class="form-group">\n`;
  html += `  <label for="${paramName}">${paramInfo.description}</label>\n`;

  const required = paramInfo.required ? 'required' : '';
  const inputType = paramInfo.hidden ? 'password' : 'text';

  switch (paramInfo.type) {
    case 'string': {
      const value = paramInfo.default ?? '';
      html += `  <input type="${inputType}" id="${paramName}" name="${paramName}" value="${String(value)}" ${required}>\n`;
      break;
    }
    case 'integer':
    case 'number': {
      const value = paramInfo.default ?? 0;
      const min = paramInfo.min !== undefined ? `min="${paramInfo.min}"` : '';
      const max = paramInfo.max !== undefined ? `max="${paramInfo.max}"` : '';
      html += `  <input type="number" id="${paramName}" name="${paramName}" value="${String(value)}" ${min} ${max} ${required}>\n`;
      break;
    }
    case 'boolean': {
      const checked = paramInfo.default ? 'checked' : '';
      html += `  <input type="checkbox" id="${paramName}" name="${paramName}" ${checked}>\n`;
      break;
    }
  }

  if (paramInfo.env_var) {
    html += `  <small>Can also be set with the ${paramInfo.env_var} environment variable</small>\n`;
  }

  html += '</div>\n';
  return html;
}

let form = '<form>\n';
if (webSearchSchema) {
  for (const [name, info] of Object.entries(webSearchSchema.parameters)) {
    form += generateFormField(name, info);
  }
}
form += '</form>';
console.log(form);
```

The form skips `object` and `array` parameters, such as `swaig_fields`, which need their own editors.

### Programmatic Skill Configuration

The SDK doesn't enforce `required`, so a tool that assembles configurations can check it before it adds the skill. This example rejects a `web_search` configuration that's missing a required parameter:

```typescript
import { AgentBase, listSkillsWithParams, registerBuiltinSkills } from '@signalwire/sdk';

registerBuiltinSkills();

const webSearchParams: Record<string, unknown> = {
  api_key: process.env['GOOGLE_SEARCH_API_KEY'],
  search_engine_id: process.env['GOOGLE_SEARCH_ENGINE_ID'],
  num_results: 3,
  max_content_length: 3000,
};

const parameters = listSkillsWithParams()['web_search']?.parameters ?? {};
const missing = Object.entries(parameters)
  .filter(([name, info]) => info.required && webSearchParams[name] === undefined)
  .map(([name]) => name);

if (missing.length > 0) {
  console.error(`Missing required parameters: ${missing.join(', ')}`);
} else {
  const agent = new AgentBase({ name: 'my-agent' });
  await agent.addSkillByName('web_search', webSearchParams);
}
```

The check reads only the configuration. Some skills fall back to an environment variable, and some have a `required` parameter they never read, as the [Skills System Guide](skills-guide.md#built-in-skills) notes for each skill.

## Parameter Schema Reference

Each parameter's entry (`ParameterSchemaEntry`) can have these properties:

| Property | Type | Description |
|----------|------|-------------|
| `type` | string | `"string"`, `"integer"`, `"number"`, `"boolean"`, `"object"` or `"array"` (required) |
| `description` | string | Description of the parameter (required) |
| `default` | any | Value the skill uses when the parameter is absent |
| `required` | boolean | Whether the parameter must be set. Absent means `false`. |
| `hidden` | boolean | Whether a form should mask the value, as for a key or password |
| `env_var` | string | Environment variable a configuration tool can read this value from. The SDK doesn't read it: the skill gets the value from its params |
| `enum` | array | Allowed values |
| `min` | number | Lowest allowed value, for numbers |
| `max` | number | Highest allowed value, for numbers |
| `items` | object | JSON Schema of each element, for arrays |

`required`, `enum`, `min` and `max` describe the valid values. The SDK doesn't enforce them.

## Implementing Parameter Schema in Skills

Override the static `getParameterSchema()` and spread the base schema from `super`, so the base parameters stay in it. This skill declares six parameters and reads them in `setup()`:

```typescript
import { SkillBase, type ParameterSchemaEntry, type SkillToolDefinition } from '@signalwire/sdk';

class MyCustomSkill extends SkillBase {
  static override SKILL_NAME = 'my_custom_skill';
  static override SKILL_DESCRIPTION = 'Looks up records in an inventory API';
  static override SKILL_VERSION = '1.0.0';

  private apiEndpoint = 'https://api.example.com';
  private apiKey?: string;
  private timeout = 30;

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      // swaig_fields and skip_prompt, plus tool_name for multi-instance skills
      ...super.getParameterSchema(),
      api_endpoint: {
        type: 'string',
        description: 'API endpoint URL',
        required: false,
        default: 'https://api.example.com',
      },
      api_key: {
        type: 'string',
        description: 'API authentication key',
        required: true,
        hidden: true,
        env_var: 'MY_API_KEY', // Where a configuration tool can find it
      },
      timeout: {
        type: 'integer',
        description: 'Request timeout in seconds',
        default: 30,
        required: false,
        min: 1,
        max: 300,
      },
      retry_count: {
        type: 'integer',
        description: 'Number of retries on failure',
        default: 3,
        required: false,
        min: 0,
        max: 10,
      },
      output_format: {
        type: 'string',
        description: 'Output format for results',
        default: 'json',
        required: false,
        enum: ['json', 'xml', 'text'],
      },
      enable_cache: {
        type: 'boolean',
        description: 'Enable response caching',
        default: true,
        required: false,
      },
    };
  }

  override async setup(): Promise<boolean> {
    this.apiEndpoint = this.getConfig<string>('api_endpoint', 'https://api.example.com');
    this.apiKey = this.getConfig<string | undefined>('api_key');
    this.timeout = this.getConfig<number>('timeout', 30);
    if (!this.apiKey) {
      this.logger.error('api_key is required');
      return false;
    }
    if (this.timeout < 1 || this.timeout > 300) {
      this.logger.error('timeout must be from 1 to 300 seconds');
      return false;
    }
    return true;
  }

  override getTools(): SkillToolDefinition[] {
    return [];
  }
}
```

The `setup()` checks are what enforce `required` and the range. When `setup()` returns `false`, the skill isn't added.

## Common Parameter Patterns

### API Keys and Secrets

Mark a key as `hidden`, and name the usual environment variable in `env_var`, so a configuration tool can fill the value in:

<!-- snippet: no-compile bare schema-entry object-literal fragment -->
```typescript
api_key: {
  type: 'string',
  description: 'API key for authentication',
  required: true,
  hidden: true,
  env_var: 'SERVICE_API_KEY',
}
```

The SDK doesn't read the variable, so the skill gets the value from its params. A skill that should also fall back to the variable reads it in `setup()` itself.

### Numeric Parameters with Constraints

Use `min` and `max` to document the valid range, and check it in `setup()`:

<!-- snippet: no-compile bare schema-entry object-literal fragment -->
```typescript
port: {
  type: 'integer',
  description: 'Server port number',
  default: 8080,
  required: false,
  min: 1,
  max: 65535,
}
```

### Enumerated Values

Use `enum` to list the allowed values:

<!-- snippet: no-compile bare schema-entry object-literal fragment -->
```typescript
log_level: {
  type: 'string',
  description: 'Logging level',
  default: 'info',
  required: false,
  enum: ['debug', 'info', 'warn', 'error'],
}
```

### Optional Features

Use a boolean parameter to turn a feature on or off:

<!-- snippet: no-compile bare schema-entry object-literal fragment -->
```typescript
enable_analytics: {
  type: 'boolean',
  description: 'Enable analytics tracking',
  default: false,
  required: false,
}
```

## Base Parameters

`SkillBase.getParameterSchema()` returns these parameters, so every skill that spreads it has them:

- **`swaig_fields`** (object, default `{}`): fields copied into every tool definition the skill registers
- **`skip_prompt`** (boolean, default `false`): when `true`, the skill adds no prompt sections
- **`tool_name`** (string, default the skill's `SKILL_NAME`): only for a class with `SUPPORTS_MULTIPLE_INSTANCES = true`, to tell instances apart

A skill can redeclare a base parameter with its own description or default, or remove one it doesn't use. `joke`, `swml_transfer` and `native_vector_search`, for example, redeclare `tool_name` with the tool's default name, and `spider`, whose `tool_name` is a prefix, redeclares it with no default. `info_gatherer` and `claude_skills` name their tools with `prefix` and `tool_prefix`, and never read `tool_name`, so their schemas leave it out.

## Examples

### Skill With No Extra Parameters

Skills such as `datetime` and `math` return the base schema:

<!-- snippet: no-compile bare static-method fragment (class body context) -->
```typescript
static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
  return { ...super.getParameterSchema() };
}
```

### Complex Skill (Many Parameters)

A skill such as `web_search` spreads the base schema and adds its own parameters. This is part of its schema:

<!-- snippet: no-compile bare static-method fragment (class body context) -->
```typescript
static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
  return {
    ...super.getParameterSchema(),
    api_key: {
      type: 'string',
      description: 'Google Custom Search API key',
      required: true,
      hidden: true,
      env_var: 'GOOGLE_SEARCH_API_KEY',
    },
    num_results: {
      type: 'integer',
      description: 'Number of high-quality results to return',
      default: 3,
      required: false,
      min: 1,
      max: 10,
    },
    safe_search: {
      type: 'string',
      description: 'Safe search level.',
      default: 'medium',
      enum: ['off', 'medium', 'high'],
    },
  };
}
```

## Best Practices

These practices keep a schema accurate and useful:

1. **Describe every parameter.** `description` is required, and forms show it as the label.
2. **Set defaults that work.** A skill with sensible defaults loads with a short configuration.
3. **Mark secrets as `hidden`.** A form can then mask them.
4. **Use the narrowest type.** Use `integer` for whole numbers, and `enum` for a fixed set of strings.
5. **Treat `env_var` as a hint for tools.** A configuration tool reads the variable; the SDK doesn't, so the skill reads only its params unless its `setup()` reads the variable.
6. **Check values in `setup()`.** The SDK doesn't enforce `required`, `enum`, `min` or `max`.
7. **Spread the base schema.** Start the object with `...super.getParameterSchema()`.
8. **Keep the schema and the code in step.** Use the same default in both places, so the schema reports what the skill does.
