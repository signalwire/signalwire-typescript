# Configuration

## Table of Contents

- [Overview](#overview)
- [Constructor Options](#constructor-options)
- [Environment Variables](#environment-variables)
- [Config Files](#config-files)
- [Authentication](#authentication)
- [Logging](#logging)
- [Priority Order](#priority-order)

---

## Overview

The SignalWire AI Agents TypeScript SDK provides three layers of configuration:

1. **Constructor options** -- passed directly when instantiating `AgentBase`.
2. **Environment variables** -- read at startup for server, security, logging, and proxy settings.
3. **Config files** -- JSON files loaded via `ConfigLoader` with environment variable interpolation.

These layers follow a well-defined priority order (see [Priority Order](#priority-order)) so that runtime overrides always take precedence over static defaults.

---

## Constructor Options

Pass an `AgentOptions` object to the `AgentBase` constructor to configure agent behavior. The interface is defined in `src/types.ts`.

```typescript
import { AgentBase } from '@anthropic/signalwire-agents';

const agent = new AgentBase({
  name: 'support-bot',
  route: '/support',
  port: 8080,
  basicAuth: ['admin', 's3cret'],
  autoAnswer: true,
  recordCall: true,
  tokenExpirySecs: 7200,
});
```

### AgentOptions Reference

| Property | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | **(required)** | Display name of the agent. Also used as the default basic-auth username when credentials are auto-generated. |
| `route` | `string` | `"/"` | HTTP route path the agent listens on. Trailing slashes are stripped. |
| `host` | `string` | `"0.0.0.0"` | Hostname to bind the HTTP server to. |
| `port` | `number` | `PORT` env or `3000` | Port number for the HTTP server. |
| `basicAuth` | `[string, string]` | auto-generated | Explicit basic-auth credentials as `[username, password]`. If omitted, credentials are read from env vars or auto-generated. |
| `usePom` | `boolean` | `true` | Whether to use POM-based (Prompt Object Model) prompt rendering. |
| `tokenExpirySecs` | `number` | `3600` | Session token expiry in seconds for HMAC-signed SWAIG tokens. |
| `autoAnswer` | `boolean` | `true` | Whether to automatically insert an `answer` verb in the SWML call flow. |
| `recordCall` | `boolean` | `false` | Whether to record the call. |
| `recordFormat` | `string` | `"mp4"` | Recording format (e.g. `"mp4"`). |
| `recordStereo` | `boolean` | `true` | Whether to record in stereo. |
| `defaultWebhookUrl` | `string` | `null` | Default webhook URL for SWAIG function callbacks. |
| `nativeFunctions` | `string[]` | `[]` | List of native (platform-built-in) function names to include in the SWAIG configuration. |
| `agentId` | `string` | random hex (16 chars) | Unique identifier for this agent instance. Auto-generated via `randomBytes(8).toString('hex')` if omitted. |
| `suppressLogs` | `boolean` | `false` | When true, suppresses all log output from this agent. |

---

## Environment Variables

The SDK reads the following environment variables at startup. All are optional.

### Server

| Variable | Type | Default | Description |
|---|---|---|---|
| `PORT` | `number` | `3000` | HTTP server port. Overridden by the constructor `port` option. |

### Authentication

| Variable | Type | Default | Description |
|---|---|---|---|
| `SWML_BASIC_AUTH_USER` | `string` | -- | Basic-auth username. Used when no `basicAuth` constructor option is provided. |
| `SWML_BASIC_AUTH_PASSWORD` | `string` | -- | Basic-auth password. Both `_USER` and `_PASSWORD` must be set for env-based auth. |

### Proxy Detection

| Variable | Type | Default | Description |
|---|---|---|---|
| `SWML_PROXY_URL_BASE` | `string` | -- | External-facing base URL for webhook URL generation (e.g. `https://my-agent.example.com`). When set, this takes priority over header-based proxy detection. |
| `SWML_PROXY_DEBUG` | `"true"` | -- | When `"true"`, logs proxy detection diagnostics at debug level. |

### Logging

| Variable | Type | Default | Description |
|---|---|---|---|
| `SIGNALWIRE_LOG_LEVEL` | `"debug" \| "info" \| "warn" \| "error"` | `"info"` | Minimum log level. Messages below this level are suppressed. |
| `SIGNALWIRE_LOG_MODE` | `"off"` | -- | Set to `"off"` to suppress all log output globally. |
| `SIGNALWIRE_LOG_FORMAT` | `"text" \| "json"` | `"text"` | Log output format. `"text"` is human-readable; `"json"` emits structured JSON per line. |
| `SIGNALWIRE_LOG_COLOR` | `"true" \| "false"` | auto (TTY detection) | Enable or disable ANSI color codes in text-format output. Defaults to `true` when stdout is a TTY. |

### Security

| Variable | Type | Default | Description |
|---|---|---|---|
| `SWML_CORS_ORIGINS` | `string` | `"*"` (all origins) | Comma-separated list of allowed CORS origins. Example: `"https://app.example.com,https://admin.example.com"`. |
| `SWML_ALLOWED_HOSTS` | `string` | -- (disabled) | Comma-separated allowlist of hostnames. Requests with a `Host` header not in this list receive a 403 response. |
| `SWML_MAX_REQUEST_SIZE` | `number` | `1048576` (1 MB) | Maximum allowed `Content-Length` in bytes. Requests exceeding this limit receive a 413 response. |
| `SWML_RATE_LIMIT` | `number` | -- (disabled) | Maximum requests per minute per IP address. When exceeded, the client receives a 429 response. |
| `SWML_REQUEST_TIMEOUT` | `number` | `30000` (30 sec) | Request timeout in milliseconds. |

### SSL/TLS

| Variable | Type | Default | Description |
|---|---|---|---|
| `SWML_SSL_ENABLED` | `"true"` | `false` | Enable SSL/TLS for the HTTP server. |
| `SWML_SSL_CERT_PATH` | `string` | -- | Filesystem path to the PEM-encoded certificate file. |
| `SWML_SSL_KEY_PATH` | `string` | -- | Filesystem path to the PEM-encoded private key file. |
| `SWML_SSL_DOMAIN` | `string` | -- | Domain name used for HSTS (Strict-Transport-Security) headers. |

### Skills

| Variable | Type | Default | Description |
|---|---|---|---|
| `SIGNALWIRE_SKILL_PATHS` | `string` | -- | Colon-separated list of directories to scan for skill modules. |

### Schema Validation

| Variable | Type | Default | Description |
|---|---|---|---|
| `SWML_SKIP_SCHEMA_VALIDATION` | `"true"` | `false` | When `"true"`, skips JSON schema validation of SWML documents. |

---

## Config Files

The `ConfigLoader` class (`src/ConfigLoader.ts`) provides JSON configuration file loading with environment variable interpolation and dot-notation access.

### Loading a Config File

```typescript
import { ConfigLoader } from '@anthropic/signalwire-agents';

// Load by explicit path
const config = new ConfigLoader('./config/agent.json');

// Or load after construction
const config2 = new ConfigLoader();
config2.load('/etc/signalwire/agent.json');
```

### JSON Format with Environment Variable Interpolation

Config files are standard JSON with `${VAR|default}` interpolation syntax. Environment variables are resolved at load time.

```json
{
  "server": {
    "port": "${PORT|3000}",
    "host": "${HOST|0.0.0.0}"
  },
  "auth": {
    "username": "${SWML_BASIC_AUTH_USER|admin}",
    "password": "${SWML_BASIC_AUTH_PASSWORD}"
  },
  "agent": {
    "name": "My Agent",
    "model": "gpt-4"
  }
}
```

**Interpolation rules:**

- `${VAR}` -- replaced with the value of environment variable `VAR`, or an empty string if unset.
- `${VAR|default}` -- replaced with the value of `VAR`, or `"default"` if `VAR` is not set.

### Search Paths

The static `ConfigLoader.search()` method looks for a config file in three standard locations, in order:

1. Current working directory (`process.cwd()`)
2. `./config/` subdirectory
3. `$HOME/.signalwire/`

```typescript
// Searches CWD, ./config/, and ~/.signalwire/ for "agent.json"
const config = ConfigLoader.search('agent.json');
if (config) {
  console.log('Loaded from:', config.getFilePath());
}
```

### Dot-Notation Access

Use dot-separated paths to read and write nested values:

```typescript
const config = new ConfigLoader('./config/agent.json');

// Read nested values with optional defaults
const port = config.get<number>('server.port', 3000);
const name = config.get<string>('agent.name', 'default-agent');

// Check existence
if (config.has('auth.password')) {
  // ...
}

// Write nested values (intermediate objects created automatically)
config.set('agent.temperature', 0.7);

// Get entire config as a plain object
const all = config.getAll();
```

### Loading from Objects

For testing or programmatic configuration, load from a plain object:

```typescript
const config = new ConfigLoader();
config.loadFromObject({
  server: { port: 8080 },
  agent: { name: 'test-agent' },
});
```

---

## Authentication

### Basic Auth in AgentBase

`AgentBase` uses Hono's built-in `basicAuth` middleware on all routes. Credentials are resolved in this order:

1. **Constructor option** -- `basicAuth: ['user', 'pass']` in `AgentOptions` (source: `"provided"`).
2. **Environment variables** -- `SWML_BASIC_AUTH_USER` and `SWML_BASIC_AUTH_PASSWORD` (source: `"environment"`).
3. **Auto-generated** -- agent name as username with a random 16-character hex password (source: `"generated"`).

```typescript
// 1. Explicit credentials
const agent = new AgentBase({
  name: 'bot',
  basicAuth: ['admin', 's3cret'],
});

// 2. Environment-based (set SWML_BASIC_AUTH_USER and SWML_BASIC_AUTH_PASSWORD)
const agent2 = new AgentBase({ name: 'bot' });

// Inspect the credentials and their source
const [user, pass, source] = agent.getBasicAuthCredentials(true);
// source: 'provided' | 'environment' | 'generated'
```

### Custom Basic Auth Validation

Override `validateBasicAuth()` in a subclass to add custom validation logic (e.g., database lookups). This hook runs after the standard credential check.

```typescript
class MyAgent extends AgentBase {
  validateBasicAuth(username: string, password: string): boolean {
    // Add custom checks beyond credential matching
    return username !== 'blocked-user';
  }
}
```

### AuthHandler (Multi-Method Auth)

The `AuthHandler` class (`src/AuthHandler.ts`) supports multiple authentication methods with constant-time (timing-safe) credential comparison:

```typescript
import { AuthHandler } from '@anthropic/signalwire-agents';

const auth = new AuthHandler({
  bearerToken: 'my-secret-token',        // Authorization: Bearer my-secret-token
  apiKey: 'my-api-key-123',              // X-Api-Key: my-api-key-123
  basicAuth: ['admin', 'password'],       // Authorization: Basic base64(admin:password)
  customValidator: async (req) => {       // Custom logic
    return req.headers['x-custom'] === 'valid';
  },
});

// Use as Hono middleware
app.use('/protected/*', auth.middleware());

// Or validate manually
const isValid = await auth.validate(requestHeaders);
```

**Validation order:** Bearer token, API key, Basic auth, Custom validator. The first match succeeds. If no methods are configured, all requests are allowed (backwards compatibility).

**Introspection methods:**

| Method | Returns | Description |
|---|---|---|
| `hasBearerAuth()` | `boolean` | Whether a bearer token is configured |
| `hasApiKeyAuth()` | `boolean` | Whether an API key is configured |
| `hasBasicAuth()` | `boolean` | Whether basic auth credentials are configured |

---

## Logging

The `Logger` class (`src/Logger.ts`) provides structured logging with environment-variable-based configuration.

### Log Levels

Four severity levels are supported, in ascending order:

| Level | Numeric | Description |
|---|---|---|
| `debug` | 0 | Verbose diagnostic information |
| `info` | 1 | General operational information (default) |
| `warn` | 2 | Potentially harmful situations |
| `error` | 3 | Error events that might still allow the application to continue |

### Basic Usage

```typescript
import { getLogger } from '@anthropic/signalwire-agents';

const log = getLogger('MyModule');

log.debug('Processing request', { requestId: '123' });
log.info('Agent started');
log.warn('Token expiring soon', { expiresIn: 300 });
log.error('Connection failed', { host: 'example.com' });
```

### Text Format (Default)

When `SIGNALWIRE_LOG_FORMAT` is `"text"` (the default):

```
[INFO] [MyModule] Agent started
[WARN] [MyModule] Token expiring soon {"expiresIn":300}
```

With color enabled (auto-detected when stdout is a TTY), level tags are color-coded:
- `debug` -- cyan
- `info` -- green
- `warn` -- yellow
- `error` -- red

### JSON Format

Set `SIGNALWIRE_LOG_FORMAT=json` for structured output:

```json
{"timestamp":"2025-01-15T10:30:00.000Z","level":"info","logger":"MyModule","message":"Agent started"}
```

### Context Binding with `bind()`

Create child loggers with additional context fields merged into every log entry:

```typescript
const log = getLogger('Handler');

const requestLog = log.bind({ requestId: '456', callId: 'abc-123' });
requestLog.info('Handling request');
// Output includes requestId and callId in every entry
```

### Programmatic Configuration

```typescript
import {
  setGlobalLogLevel,
  suppressAllLogs,
  setGlobalLogFormat,
  setGlobalLogColor,
  resetLoggingConfiguration,
} from '@anthropic/signalwire-agents';

// Change log level at runtime
setGlobalLogLevel('debug');

// Suppress all output
suppressAllLogs(true);

// Switch to JSON format
setGlobalLogFormat('json');

// Force color on/off
setGlobalLogColor(false);

// Reset everything to env-var defaults
resetLoggingConfiguration();
```

### Environment Variable Summary

| Variable | Values | Default | Description |
|---|---|---|---|
| `SIGNALWIRE_LOG_LEVEL` | `debug`, `info`, `warn`, `error` | `info` | Minimum level to emit |
| `SIGNALWIRE_LOG_MODE` | `off` | -- | Set to `off` to suppress all output |
| `SIGNALWIRE_LOG_FORMAT` | `text`, `json` | `text` | Output format |
| `SIGNALWIRE_LOG_COLOR` | `true`, `false` | auto (TTY) | ANSI color codes in text mode |

---

## Priority Order

When the same setting can be configured in multiple places, the following priority order applies (highest to lowest):

```
Environment Variables  >  Constructor Options  >  Config File  >  Defaults
```

Specific resolution examples:

| Setting | Resolution |
|---|---|
| **Port** | `PORT` env var > `opts.port` > `3000` |
| **Basic auth** | `opts.basicAuth` > `SWML_BASIC_AUTH_USER`/`PASSWORD` env vars > auto-generated |
| **Log level** | `SIGNALWIRE_LOG_LEVEL` env var > programmatic `setGlobalLogLevel()` > `"info"` |
| **CORS origins** | `SWML_CORS_ORIGINS` env var > `"*"` (permissive default) |
| **Proxy URL** | `SWML_PROXY_URL_BASE` env var > `manualSetProxyUrl()` > header-based detection > local URL |
| **SSL** | `SslOptions` constructor > `SWML_SSL_*` env vars > disabled |

Note that basic auth is an exception: the constructor option takes precedence over environment variables. For most other settings, environment variables override constructor options to support container-based deployment patterns where env vars are the primary configuration mechanism.
