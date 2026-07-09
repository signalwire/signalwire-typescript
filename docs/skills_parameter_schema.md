# Skills Parameter Schema System

This guide explains the parameter schema system for SignalWire AI Agents TypeScript SDK skills, which enables GUI configuration tools and programmatic skill discovery.

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module so top-level `await` is allowed
declare global {
  // Node globals (tsconfig sets types:[], so declare them here).
  const process: { env: Record<string, string | undefined>; [k: string]: any };
}
```

## Overview

The parameter schema system lets skills declare their configurable parameters with metadata including types, descriptions, default values, and security hints. This enables:

- **GUI Configuration Tools** - Automatically generate configuration forms
- **API Documentation** - Document all available parameters
- **Validation** - Type checking and constraint hints
- **Security** - Mark sensitive parameters as hidden
- **Environment Variables** - Indicate which parameters can be sourced from the environment

## Using the Schema System

### Getting All Skills Schema

Use the `listSkillsWithParams()` function to get a complete schema of all registered skills,
keyed by skill name:

```typescript
import { listSkillsWithParams } from '@signalwire/sdk';

// Get complete schema for all skills
const schema = listSkillsWithParams();

// Example output structure:
// {
//   web_search: {
//     name: 'web_search',
//     description: 'Search the web using Google Custom Search',
//     version: '1.0.0',
//     parameters: {
//       api_key: {
//         type: 'string',
//         description: 'Google Custom Search API key',
//         required: true,
//         hidden: true,
//         env_var: 'GOOGLE_SEARCH_API_KEY',
//       },
//       search_engine_id: {
//         type: 'string',
//         description: 'Google Custom Search Engine ID',
//         required: true,
//         hidden: true,
//         env_var: 'GOOGLE_SEARCH_ENGINE_ID',
//       },
//       num_results: {
//         type: 'integer',
//         description: 'Default number of search results to return',
//         default: 1,
//         required: false,
//         min: 1,
//         max: 10,
//       },
//     },
//   },
//   datetime: {
//     name: 'datetime',
//     description: 'Get current date, time, and timezone information',
//     version: '1.0.0',
//     parameters: {
//       swaig_fields: {
//         type: 'object',
//         description: 'Additional SWAIG function metadata to merge into tool definitions',
//         default: {},
//         required: false,
//       },
//     },
//   },
// }
```

### Using Schema for GUI Configuration

Here's an example of using the schema to generate a configuration form:

```typescript
import { listSkillsWithParams, registerBuiltinSkills } from '@signalwire/sdk';

// Populate the registry with the built-in skills before introspecting it.
await registerBuiltinSkills();

const schema = listSkillsWithParams();
const webSearchSchema = schema['web_search'];

function generateFormField(paramName: string, paramInfo: Record<string, unknown>): string {
  let html = `<div class="form-group">\n`;
  html += `  <label for="${paramName}">${paramInfo['description']}</label>\n`;

  const required = paramInfo['required'] ? 'required' : '';
  // Hide sensitive fields
  const inputType = paramInfo['hidden'] ? 'password' : 'text';

  switch (paramInfo['type']) {
    case 'string': {
      const value = paramInfo['default'] ?? '';
      html += `  <input type="${inputType}" id="${paramName}" name="${paramName}" value="${value}" ${required}>\n`;
      break;
    }
    case 'integer':
    case 'number': {
      const value = paramInfo['default'] ?? 0;
      const min = 'min' in paramInfo ? `min="${paramInfo['min']}"` : '';
      const max = 'max' in paramInfo ? `max="${paramInfo['max']}"` : '';
      html += `  <input type="number" id="${paramName}" name="${paramName}" value="${value}" ${min} ${max} ${required}>\n`;
      break;
    }
    case 'boolean': {
      const checked = paramInfo['default'] ? 'checked' : '';
      html += `  <input type="checkbox" id="${paramName}" name="${paramName}" ${checked}>\n`;
      break;
    }
  }

  if ('env_var' in paramInfo) {
    html += `  <small>Can also be set via the ${paramInfo['env_var']} environment variable</small>\n`;
  }

  html += '</div>\n';
  return html;
}

let form = '<form>\n';
for (const [name, info] of Object.entries(webSearchSchema.parameters)) {
  form += generateFormField(name, info as unknown as Record<string, unknown>);
}
form += '</form>';
```

### Programmatic Skill Configuration

Use the schema to validate configuration before adding a skill:

```typescript
import { AgentBase, listSkillsWithParams } from '@signalwire/sdk';

class MyAgent extends AgentBase {
  static async create(): Promise<MyAgent> {
    const agent = new MyAgent({ name: 'my-agent' });

    const schema = listSkillsWithParams();

    const webSearchParams: Record<string, unknown> = {
      api_key: 'your-api-key',
      search_engine_id: 'your-engine-id',
      num_results: 3,
      max_content_length: 3000,
    };

    // Validate required parameters against the declared schema
    const webSearchSchema = schema['web_search'].parameters;
    for (const [param, info] of Object.entries(webSearchSchema)) {
      if ((info as { required?: boolean }).required && !(param in webSearchParams)) {
        throw new Error(`Missing required parameter: ${param}`);
      }
    }

    // Add the skill with validated parameters
    await agent.addSkillByName('web_search', webSearchParams);
    return agent;
  }
}
```

## Parameter Schema Reference

Each parameter in the schema (`ParameterSchemaEntry`) can have the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `type` | string | Parameter type: `"string"`, `"integer"`, `"number"`, `"boolean"`, `"object"`, `"array"` |
| `description` | string | Human-readable description of the parameter |
| `default` | any | Default value if not provided |
| `required` | boolean | Whether the parameter is required (default: false) |
| `hidden` | boolean | Whether to hide this field in UIs (for secrets/API keys) |
| `env_var` | string | Environment variable that can provide this value |
| `enum` | array | List of allowed values (for string types) |
| `min` | number | Minimum value (for numeric types) |
| `max` | number | Maximum value (for numeric types) |

## Implementing Parameter Schema in Skills

To add parameter-schema support to a skill, override the static `getParameterSchema()`
method and spread the base schema from `super`:

```typescript
import { SkillBase, type ParameterSchemaEntry, type SkillToolDefinition } from '@signalwire/sdk';

class MyCustomSkill extends SkillBase {
  static override SKILL_NAME = 'my_custom_skill';
  static override SKILL_DESCRIPTION = 'My custom skill';
  static override SKILL_VERSION = '1.0.0';
  static override REQUIRED_ENV_VARS = [] as const;

  private apiEndpoint?: string;
  private apiKey?: string;
  private timeout = 30;

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      // Base schema includes common parameters (e.g. swaig_fields)
      ...super.getParameterSchema(),
      api_endpoint: {
        type: 'string',
        description: 'API endpoint URL',
        required: true,
        default: 'https://api.example.com',
      },
      api_key: {
        type: 'string',
        description: 'API authentication key',
        required: true,
        hidden: true, // Mark as sensitive
        env_var: 'MY_API_KEY', // Can be set via environment
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
    // Access parameters via getConfig()
    this.apiEndpoint = this.getConfig<string>('api_endpoint', 'https://api.example.com');
    this.apiKey = this.getConfig<string>('api_key', '') || process.env['MY_API_KEY'];
    this.timeout = this.getConfig<number>('timeout', 30);
    return true;
  }

  override getTools(): SkillToolDefinition[] {
    return [];
  }
}
```

## Common Parameter Patterns

### API Keys and Secrets

Always mark sensitive parameters as `hidden` and provide an `env_var` option:

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

### Numeric Parameters with Constraints

Use `min` and `max` to document valid ranges:

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

Use `enum` to restrict to specific values:

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

Use boolean parameters for optional features:

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

All skills inherit base parameters from `SkillBase` via `super.getParameterSchema()`:

- **`swaig_fields`** (object) - Additional SWAIG function metadata merged into tool definitions.

## Examples

### Simple Skill (No Parameters)

Skills like `datetime` and `math` that don't need configuration just return the base schema:

<!-- snippet: no-compile bare static-method fragment (class body context) -->
```typescript
static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
  return super.getParameterSchema();
}
```

### Complex Skill (Many Parameters)

Skills like `web_search` with multiple configuration options spread the base schema and add
their own:

<!-- snippet: no-compile bare static-method fragment (class body context) -->
```typescript
static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
  return {
    ...super.getParameterSchema(),
    // API credentials (hidden)
    api_key: { type: 'string', required: true, hidden: true, env_var: 'GOOGLE_SEARCH_API_KEY' },
    search_engine_id: { type: 'string', required: true, hidden: true, env_var: 'GOOGLE_SEARCH_ENGINE_ID' },
    // Configuration options
    num_results: { type: 'integer', default: 1, required: false, min: 1, max: 10 },
    safe_search: { type: 'string', default: 'medium', enum: ['off', 'medium', 'high'] },
  };
}
```

## Best Practices

1. **Always provide descriptions** - Make parameters self-documenting.
2. **Set sensible defaults** - Allow skills to work with minimal configuration.
3. **Mark secrets as hidden** - Protect sensitive information in UIs.
4. **Use appropriate types** - Enable proper validation and UI controls.
5. **Document environment variables** - Show alternative configuration methods.
6. **Validate in `setup()`** - Ensure all required parameters are present.
7. **Spread the base schema** - Always include `...super.getParameterSchema()`.
