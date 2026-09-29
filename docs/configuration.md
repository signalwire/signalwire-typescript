# Configuration

This page lists the settings the TypeScript SDK reads: constructor options, environment variables and JSON config files. It also covers authentication and logging, and which source wins when a setting comes from more than one place.

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module (top-level await)
declare global {
  const ConfigLoader: typeof import('@signalwire/sdk').ConfigLoader;
  const AgentBase: typeof import('@signalwire/sdk').AgentBase; // used with `extends`
  const getLogger: typeof import('@signalwire/sdk').getLogger;
  const app: any; // Hono app
  const requestHeaders: Record<string, string>;
}
```

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

The SDK has three layers of configuration:

1. **Constructor options**: passed to `new AgentBase({...})`, `new SWMLService({...})` or `new WebService({...})`.
2. **Environment variables**: read for server, security, logging, proxy, RELAY, REST and skill settings.
3. **Config files**: JSON files loaded with `ConfigLoader`, with `${VAR|default}` substitution from the environment.

A constructor option wins over the config file, and the config file wins over the environment, for the settings all three can supply. Some settings come from only one layer. [Priority Order](#priority-order) lists each case.

---

## Constructor Options

Pass an `AgentOptions` object to the `AgentBase` constructor. The interface is defined in `src/types.ts`.

```typescript
import { AgentBase } from '@signalwire/sdk';

const agent = new AgentBase({
  name: 'support-bot',
  route: '/support',
  port: 8080,
  basicAuth: ['admin', 'a-long-random-password'],
  autoAnswer: true,
  recordCall: true,
  tokenExpirySecs: 7200,
});
```

### AgentOptions Reference

| Property | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | (required) | Name of the agent. Also the basic-auth username when the SDK generates credentials and `SWML_BASIC_AUTH_USER` is unset. |
| `route` | `string` | `"/"` | HTTP route the agent serves. Trailing slashes are stripped. Falls back to the config file's `service.route`. |
| `host` | `string` | `"0.0.0.0"` | Address the HTTP server binds to. Falls back to the config file's `service.host`. |
| `port` | `number` | `3000` | Port for the HTTP server. Falls back to the config file's `service.port`, then `PORT`, then `3000`. A value outside 1 to 65535 throws. |
| `basicAuth` | `[string, string]` | generated | Basic-auth credentials as `[username, password]`. [Authentication](#authentication) describes the fallbacks. |
| `usePom` | `boolean` | `true` | Build the prompt from sections (the Prompt Object Model) instead of raw text. |
| `tokenExpirySecs` | `number` | `3600` | Lifetime, in seconds, of the per-call tokens that secure tools and the post-prompt URL. |
| `swaigSecret` | `string` | `SIGNALWIRE_SWAIG_SECRET`, else random per process | Secret that signs the per-call tokens. Set the same value on every replica. |
| `autoAnswer` | `boolean` | `true` | Add an `answer` verb before the AI verb. |
| `recordCall` | `boolean` | `false` | Add a `record_call` verb after the answer. |
| `recordFormat` | `string` | `"mp4"` | `format` of the `record_call` verb. |
| `recordStereo` | `boolean` | `true` | `stereo` of the `record_call` verb. |
| `defaultWebhookUrl` | `string` | none | Stored on the agent, but SWML rendering doesn't read it. Use `setWebHookUrl()` to replace the SWAIG webhook URL. |
| `nativeFunctions` | `string[]` | `[]` | Platform function names for the SWAIG `native_functions` list. |
| `agentId` | `string` | 16 random hex characters | Identifier for this agent instance. |
| `suppressLogs` | `boolean` | `false` | When `true`, calls `suppressAllLogs(true)`, which silences the SDK's logger for the whole process, not only this agent. |
| `schemaPath` | `string` | bundled schema | Path to a SWML JSON Schema file. It sets `schemaUtils` on the agent; `addVerb()` still validates against the bundled schema. |
| `schemaValidation` | `boolean` | `true` | Stored on the agent, but `addVerb()` validation doesn't read it. Set `SWML_SKIP_SCHEMA_VALIDATION=true` to turn validation off. |
| `enablePostPromptOverride` | `boolean` | `false` | Register `POST {route}/post_prompt_override`, which replaces the post-prompt text with the body's `post_prompt` value. |
| `checkForInputOverride` | `boolean` | `false` | Register `GET` and `POST {route}/check_for_input`, which log the request and echo its body. |
| `configFile` | `string` | none | Path to a JSON config file. [Config Files](#config-files) lists the keys the agent reads. |
| `signingKey` | `string` | `SIGNALWIRE_SIGNING_KEY` | Key for verifying webhook signatures on `POST` to the agent route, `/swaig`, `/post_prompt` and routing-callback paths. Requests without a valid signature get `403`. |
| `webhookTrustProxy` | `boolean` | `false` | Rebuild the signed URL from `X-Forwarded-Proto` and `X-Forwarded-Host`. Enable it only behind a proxy you control. `SWML_PROXY_URL_BASE` takes precedence over both. |

---

## Environment Variables

The SDK reads these environment variables. All are optional.

### Server

The server port has one variable:

| Variable | Type | Default | Description |
|---|---|---|---|
| `PORT` | `number` | `3000` | HTTP port for `AgentBase`, `SWMLService` and `AgentServer` when no port option (or config-file port, for `AgentBase`) is given. `WebService` doesn't read it. |

### RELAY Connection

`RelayClient` reads these. `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_API_TOKEN`, `SIGNALWIRE_JWT_TOKEN` and `SIGNALWIRE_SPACE` supply the credentials and space when the matching constructor option is omitted.

| Variable | Type | Default | Description |
|---|---|---|---|
| `SIGNALWIRE_RELAY_HOST` | `string` | none | RELAY WebSocket host. Precedence: `host` option, then `SIGNALWIRE_RELAY_HOST`, then `SIGNALWIRE_SPACE`, then `relay.signalwire.com`. |
| `SIGNALWIRE_RELAY_SCHEME` | `"ws"` or `"wss"` | `"wss"` | RELAY WebSocket scheme. The `scheme` option wins. Any other value falls back to `wss`. |
| `SIGNALWIRE_RELAY_CA_FILE` | `string` | none | Path to a CA bundle the RELAY WebSocket trusts. Unset, Node's default trust store applies. |
| `SIGNALWIRE_RELAY_PING_INTERVAL_MS` | `number` | `30000` | Milliseconds between client keepalive pings. For testing; leave unset in production. |
| `SIGNALWIRE_RELAY_PING_MAX_FAILURES` | `number` | `3` | Consecutive missed ping responses before the client reconnects. For testing; leave unset in production. |
| `SIGNALWIRE_RELAY_REQUEST_TIMEOUT_MS` | `number` | `30000` | Milliseconds a RELAY request waits for its response. For testing; leave unset in production. |
| `SIGNALWIRE_RELAY_RECONNECT_MIN_DELAY_S` | `number` | `1` | Seconds before the first reconnect attempt. For testing; leave unset in production. |
| `SIGNALWIRE_RELAY_RECONNECT_MAX_DELAY_S` | `number` | `30` | Upper limit, in seconds, of the reconnect backoff. For testing; leave unset in production. |
| `RELAY_MAX_CONNECTIONS` | `number` | `1` | Maximum `RelayClient` connections in one process. |
| `RELAY_MAX_ACTIVE_CALLS` | `number` | `1000` | Maximum concurrent calls per client, when the `maxActiveCalls` option isn't set. |

### REST Client

`RestClient` reads these when the matching constructor option is omitted:

| Variable | Type | Default | Description |
|---|---|---|---|
| `SIGNALWIRE_PROJECT_ID` | `string` | none | Project ID. |
| `SIGNALWIRE_API_TOKEN` | `string` | none | API token. |
| `SIGNALWIRE_REST_BASE_URL` | `string` | none | Full base URL, such as `http://127.0.0.1:8080`. Used when the `host` option is unset, and before `SIGNALWIRE_SPACE`. |
| `SIGNALWIRE_SPACE` | `string` | none | Space host, such as `example.signalwire.com`. |
| `SIGNALWIRE_REST_CA_FILE` | `string` | none | Path to a CA bundle the REST client trusts. |

### Authentication

These variables supply credentials and keys:

| Variable | Type | Default | Description |
|---|---|---|---|
| `SWML_BASIC_AUTH_USER` | `string` | none | Basic-auth username, used when no `basicAuth` option or config-file credentials apply. |
| `SWML_BASIC_AUTH_PASSWORD` | `string` | none | Basic-auth password. It's enough on its own: without `SWML_BASIC_AUTH_USER`, the username is `signalwire`. `SWML_BASIC_AUTH_USER` alone gives that username with a generated password. |
| `SIGNALWIRE_SIGNING_KEY` | `string` | none | Webhook signing key, used when the `signingKey` option isn't set. When neither is set, `AgentBase` logs a warning that signature validation is disabled. |
| `SIGNALWIRE_SWAIG_SECRET` | `string` | random per process | Secret that signs per-call SWAIG tokens, used when the `swaigSecret` option isn't set. Set the same value on every replica, so a token minted by one replica, or before a restart, validates on another. |

### Proxy Detection

These variables control the external URL the agent puts in its webhook URLs:

| Variable | Type | Default | Description |
|---|---|---|---|
| `SWML_PROXY_URL_BASE` | `string` | none | External base URL, such as `https://my-agent.example.com`. While it's set, request headers never change the base URL. |
| `SWML_TRUST_PROXY_HEADERS` | `"true"` | off | Read the base URL from `X-Forwarded-Host`, `Forwarded` or `X-Original-Host`, and key rate limiting by `X-Forwarded-For`. Enable it only behind a proxy you control, because clients can set these headers. |
| `SWML_PROXY_DEBUG` | `"true"` | off | Log proxy detection at debug level. |
| `SWML_ENFORCE_HTTPS` | `"true"` | off | Use `https` in the webhook URLs the agent builds from its own host and port. It doesn't reject plain-HTTP requests. |

### Logging

The logger reads these at startup:

| Variable | Type | Default | Description |
|---|---|---|---|
| `SIGNALWIRE_LOG_LEVEL` | `debug`, `info`, `warn`, `error` | `info` | Minimum level. An unknown value means `info`. |
| `SIGNALWIRE_LOG_MODE` | `off`, `stderr`, `auto` | `auto` | `off` silences the logger. `stderr` writes every line to stderr. `auto`, or unset, silences it in a CGI process and uses stderr on AWS Lambda. |
| `SIGNALWIRE_LOG_FORMAT` | `text`, `json` | `text` | Line format. |
| `SIGNALWIRE_LOG_COLOR` | `true`, `false` | stdout is a terminal | ANSI colors in text lines. Any value other than `true` turns them off. |

### Security

`AgentBase` reads these when it builds its HTTP app. [Priority Order](#priority-order) notes which other classes read them.

| Variable | Type | Default | Description |
|---|---|---|---|
| `SWML_CORS_ORIGINS` | `string` | `*` | Comma-separated allowed CORS origins. With a list, CORS responses allow credentials. |
| `SWML_ALLOWED_HOSTS` | `string` | none | Comma-separated host names. A request whose `Host` header (without the port) isn't listed gets `403`. |
| `SWML_MAX_REQUEST_SIZE` | `number` | `1048576` | Largest `Content-Length`, in bytes. A larger or non-numeric value gets `413`. A request without `Content-Length` isn't checked. |
| `SWML_RATE_LIMIT` | `number` | none | Requests per minute per client IP, answered with `429` past the limit. The IP is the connection's address, or the `X-Forwarded-For` or `X-Real-IP` address when `SWML_TRUST_PROXY_HEADERS=true`. |
| `SWML_CSRF_PROTECTION` | `"true"` | off | Refuse a `POST` whose `Origin` header isn't in `SWML_CORS_ORIGINS`, with `403`. Without `SWML_CORS_ORIGINS`, it checks nothing. |
| `SWML_USE_HSTS` | `"true"` or `"false"` | `true` | Read into `SecurityConfig.useHsts`. Only `SecurityConfig.getSecurityHeaders()` uses it; no server in the SDK calls that method. |
| `SWML_HSTS_MAX_AGE` | `number` | `31536000` | Read into `SecurityConfig.hstsMaxAge`, with the same limit as `SWML_USE_HSTS`. |
| `SWML_ALLOW_PRIVATE_URLS` | `1`, `true` or `yes` | unset | Lets the URL-fetching skills (spider, web_search) and the SDK's URL checks reach private, loopback, link-local and unspecified addresses. Leave it unset in production. |
| `SWML_URL_FETCH_USE_PROXY` | `1`, `true` or `yes` | unset | Lets the spider and web_search skills send a fetch through Node's environment proxy, when Node's proxy support is on (`NODE_USE_ENV_PROXY=1`), a proxy is set for the scheme (`HTTP_PROXY` or `HTTPS_PROXY`) and the host isn't in `NO_PROXY`. The private-address check can't apply through a proxy, so use a proxy that blocks private destinations. Other fetches still connect directly with the check. |

### SSL/TLS

`SslConfig` reads these. `SWMLService.serve()` and `WebService.start()` use them to serve HTTPS. `AgentBase.serve()` and `AgentServer.run()` serve plain HTTP whatever these say, so put a TLS-terminating proxy in front of an agent.

| Variable | Type | Default | Description |
|---|---|---|---|
| `SWML_SSL_ENABLED` | `"true"` | off | Serve HTTPS when the certificate and key paths are set. |
| `SWML_SSL_CERT_PATH` | `string` | none | Path to the PEM certificate file. |
| `SWML_SSL_KEY_PATH` | `string` | none | Path to the PEM private key file. |
| `SWML_SSL_DOMAIN` | `string` | none | Domain name stored with the SSL settings. |

### Skills

These variables control where skills come from:

| Variable | Type | Default | Description |
|---|---|---|---|
| `SIGNALWIRE_SKILL_PATHS` | `string` | none | Colon-separated directories added to the skill registry's search paths. |
| `SWML_SKILL_DISCOVERY_ENABLED` | `"true"` | off | Allow `SkillRegistry.discoverFromDirectory()` to import skill files from a directory. Without it, the method logs a warning and loads nothing. |
| `SWML_ALLOW_CUSTOM_HANDLER_CODE` | `"true"` | off | Allow the `custom_skills` skill to run handler code given as a string. Leave it unset unless you trust the skill configuration. |

### AI Chat

`AIChatClient` and `ChatGateway` read these. `AIChatClient` also reads `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_API_TOKEN` and `SIGNALWIRE_SPACE` when the matching option is omitted. `SIGNALWIRE_SPACE` can be a space name (`example`) or a host name (`example.signalwire.com`).

| Variable | Type | Default | Description |
|---|---|---|---|
| `RAILS_DEV_MODE` | `string` | none | A full URL here is the chat service URL for `AIChatClient`, unless the `url` option is set. A boolean value (`true`, `1`, `on`, `false` and so on) is ignored. |
| `SIGNALWIRE_CHAT_GATEWAY_KEY` | `string` | generated | The publishable key a `ChatGateway` accepts, used when the `key` option isn't set. Without either, the gateway generates one per process. |
| `SIGNALWIRE_CHAT_GATEWAY_SECRET` | `string` | random per process | Secret that signs `ChatGateway` conversation handles, used when the `secret` option isn't set. Set the same value on every replica; without it, handles stop verifying across replicas and restarts. |

### Schema Validation

One variable turns off SWML verb validation:

| Variable | Type | Default | Description |
|---|---|---|---|
| `SWML_SKIP_SCHEMA_VALIDATION` | `"true"` | off | Skip the schema check `addVerb()` and `addVerbToSection()` run on each verb. |

---

## Config Files

The `ConfigLoader` class (`src/ConfigLoader.ts`) loads a JSON file, substitutes environment variables into it, and reads values by dot-separated path.

### Keys the SDK Reads

Three classes take a `configFile` option. Each reads different keys:

| Class | Keys |
|---|---|
| `AgentBase` | `service.route`, `service.host`, `service.port`, plus the `security` keys `SWMLService` reads |
| `SWMLService` | `security.ssl.enabled`, `security.ssl.certPath`, `security.ssl.keyPath`, `security.ssl.domain`, and basic auth from `security.auth.basic` or `security.basicAuth` (`user`, `password`) |
| `WebService` | `service.port`, `service.directories`, `service.enableDirectoryBrowsing`, `service.maxFileSize`, `service.allowedExtensions`, `service.blockedExtensions`, `service.enableCors` |

`AgentBase` and `SWMLService` read a config file only when you pass `configFile`. `WebService` without `configFile` searches for `web_service.json` in the locations [Search Paths](#search-paths) lists. A file passed as `configFile` that is missing or isn't valid JSON is skipped, and the service starts from its other settings.

This file sets an agent's route and port, and its basic-auth credentials:

```json
{
  "service": {
    "route": "/support",
    "port": "${PORT|3000}"
  },
  "security": {
    "auth": {
      "basic": {
        "user": "${SWML_BASIC_AUTH_USER|admin}",
        "password": "${SUPPORT_AGENT_PASSWORD}"
      }
    }
  }
}
```

A constructor option beats the file: `route` or `port` passed to the constructor wins over `service.route` or `service.port`, and `basicAuth` wins over the file's credentials. The file's password beats `SWML_BASIC_AUTH_PASSWORD`. An empty `user` or `password` in the file sets nothing.

### Loading a Config File

Pass a path to the constructor, or call `load()`:

<!-- snippet: no-run reads a config file that isn't present in the repo (illustrative ConfigLoader usage) -->
```typescript
import { ConfigLoader } from '@signalwire/sdk';

// Load by explicit path; throws if the file doesn't exist
const config = new ConfigLoader('./config/agent.json');

// Or load after construction
const config2 = new ConfigLoader();
config2.load('/etc/signalwire/agent.json');

// An array loads the first file that exists, and loads nothing if none does
const config3 = new ConfigLoader(['./agent.local.json', './agent.json']);
```

### Environment Variable Substitution

`load()` replaces every `${VAR}` and `${VAR|default}` in the file's text before it parses the JSON:

- `${VAR}` becomes the value of `VAR`, or an empty string if `VAR` is unset.
- `${VAR|default}` becomes the value of `VAR`, or `default` if `VAR` is unset.

The substitution happens in the raw text, so the result is still a string when the placeholder was inside quotes. In the earlier example, `service.port` is the string `"3000"`. A value containing a double quote or a backslash breaks the JSON. `getSection()` and `substituteVars()` substitute into values instead, and turn `"true"`, `"false"` and numeric strings into booleans and numbers.

### Search Paths

The static `ConfigLoader.search(filename)` method loads the first file it finds, checking these locations in order:

1. `{cwd}/{serviceName}_{filename}` and `{cwd}/.swml/{serviceName}_{filename}`, when you pass `serviceName` as the third argument
2. `{dir}/{filename}` for each directory in the optional second argument
3. `{cwd}/{filename}`
4. `{cwd}/config/{filename}`
5. `~/.signalwire/{filename}`
6. `{cwd}/.swml/{filename}`
7. `~/.swml/{filename}`
8. `/etc/swml/{filename}`

It returns `null` when no location has the file:

```typescript
// Searches the working directory, ./config/, ~/.signalwire/, ./.swml/, ~/.swml/ and /etc/swml/
const config = ConfigLoader.search('agent.json');
if (config) {
  console.log('Loaded from:', config.getConfigFile());
}
```

`ConfigLoader.findConfigFile(serviceName?, additionalPaths?)` returns the path of the first existing file among `{serviceName}_config.json`, `.swml/{serviceName}_config.json`, the additional paths, `config.json`, `agent_config.json`, `.swml/config.json`, `~/.swml/config.json` and `/etc/swml/config.json`, without loading it.

### Dot-Notation Access

Use dot-separated paths to read and write nested values:

<!-- snippet: no-run illustrative fragment: references the assumed `ConfigLoader` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const config = new ConfigLoader('./config/agent.json');

// Read nested values with optional defaults
const port = config.get<number>('server.port', 3000);
const agentName = config.get<string>('agent.name', 'default-agent');

// Check existence
if (config.has('auth.password')) {
  // ...
}

// Write nested values (intermediate objects created automatically)
config.set('agent.temperature', 0.7);

// Get a shallow copy of the whole config
const all = config.getConfig();

// Get one top-level section, with values substituted and typed
const security = config.getSection('security');
```

A path segment of `__proto__`, `constructor` or `prototype` reads as missing, and `set()` ignores it.

### Loading from Objects

For tests, or configuration built in code, load a plain object:

```typescript
const config = new ConfigLoader();
config.loadFromObject({
  server: { port: 8080 },
  agent: { name: 'test-agent' },
});
```

`mergeWithEnv(prefix)` returns the loaded values plus every environment variable that starts with `prefix` (default `SWML_`). The prefix is stripped, the rest is lowercased and split on `_` into nested keys, and a value already in the config wins.

---

## Authentication

### Basic Auth in AgentBase

`AgentBase` requires HTTP Basic Authentication on every route except `/health` and `/ready`. It resolves the credentials in this order:

1. The `basicAuth` constructor option (source `provided`).
2. The config file's `security.auth.basic` or `security.basicAuth` password (source `config file`).
3. `SWML_BASIC_AUTH_PASSWORD`, with `SWML_BASIC_AUTH_USER` or `signalwire` as the username (source `environment`).
4. Generated: `SWML_BASIC_AUTH_USER` or the agent's name as the username, and 32 random hex characters as the password (source `generated`). The agent logs a warning, because a client outside the process can't know the password.

`getBasicAuthCredentials(true)` returns the credentials and their source:

```typescript
// 1. Explicit credentials
const agent = new AgentBase({
  name: 'bot',
  basicAuth: ['admin', 'a-long-random-password'],
});

// 2. From SWML_BASIC_AUTH_USER and SWML_BASIC_AUTH_PASSWORD, or generated
const agent2 = new AgentBase({ name: 'bot' });

// Inspect the credentials and their source
const [user, pass, source] = agent.getBasicAuthCredentials(true);
// source: 'provided' | 'config file' | 'environment' | 'generated'
```

The agent puts the credentials in the webhook URLs it renders, so SignalWire can authenticate its requests to `/swaig` and `/post_prompt`.

`SWMLService` checks the first three sources in the same order, and enforces the credentials only when one of them supplies them. Otherwise it generates credentials (the service name and a random password) but doesn't enforce them, so it serves every route without authentication. `WebService` reads only its `basicAuth` option, and serves without authentication when it's unset.

### Custom Basic Auth Validation

`AgentBase` and `SWMLService` have a `validateBasicAuth(username, password)` method, but the HTTP routes don't call it. They compare the request's credentials with the configured pair, so overriding the method doesn't change who can reach the agent. Only `SWMLService.handleRequest()`, the framework-free dispatch method, calls it.

To add your own check, put the agent's app behind middleware that runs it, such as an `AuthHandler` [custom validator](#authhandler-multi-method-auth).

### AuthHandler (Multi-Method Auth)

The `AuthHandler` class (`src/AuthHandler.ts`) checks bearer tokens, API keys, basic auth and a custom validator, comparing secrets in constant time. It's standalone: the SDK's own servers don't use it.

<!-- snippet: no-run illustrative fragment: references the assumed `app` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
import { AuthHandler } from '@signalwire/sdk';

const auth = new AuthHandler({
  bearerToken: 'a-long-random-token',         // Authorization: Bearer <token>
  apiKey: 'a-long-random-key',                // X-Api-Key: <key>
  apiKeyHeader: 'X-Api-Key',                  // optional; this is the default
  basicAuth: ['admin', 'a-long-random-password'], // Authorization: Basic base64(user:pass)
  customValidator: async (req) => {           // receives { headers, method, url }
    return req.headers['x-custom'] === 'valid';
  },
});

// Use as Hono middleware; a failed check gets 401 {"error":"Unauthorized"}
app.use('/protected/*', auth.middleware());

// Or validate a header map yourself
const isValid = await auth.validate(requestHeaders);
```

`validate()` tries the bearer token, the API key, basic auth and the custom validator, in that order, and succeeds on the first match. Header names are matched in lower case, as Hono passes them. The custom validator gets `method` and `url` as empty strings.

When no method is configured, `validate()` allows every request and logs a warning. Pass `allowUnauthenticated: false` to refuse them instead. `middleware(true)` and `expressMiddleware(true)` run the check but let failed requests through.

These methods report the configuration:

| Method | Returns | Description |
|---|---|---|
| `hasBearerAuth()` | `boolean` | Whether a bearer token is configured |
| `hasApiKeyAuth()` | `boolean` | Whether an API key is configured |
| `hasBasicAuth()` | `boolean` | Whether basic-auth credentials are configured |
| `getAuthInfo()` | object | The enabled methods, with the basic-auth username and the API key header name |

---

## Logging

The `Logger` class (`src/Logger.ts`) writes structured log lines, configured by environment variables or in code.

### Log Levels

The logger has four levels, from lowest to highest:

| Level | Use |
|---|---|
| `debug` | Diagnostic detail |
| `info` | Normal operation (the default minimum) |
| `warn` | Something that may need attention |
| `error` | A failure |

### Basic Usage

`getLogger(name)` returns a logger for that name:

```typescript
import { getLogger } from '@signalwire/sdk';

const log = getLogger('MyModule');

log.debug('Processing request', { requestId: '123' });
log.info('Agent started');
log.warn('Token expiring soon', { expiresIn: 300 });
log.error('Connection failed', { host: 'example.com' });
```

### Text Format (Default)

With `SIGNALWIRE_LOG_FORMAT` unset or `text`, the example prints these lines. The `debug` line is under the default level, so it doesn't print:

```text
2026-09-28T23:18:30.530Z [INFO] [MyModule] Agent started
2026-09-28T23:18:30.532Z [WARN] [MyModule] Token expiring soon expiresIn=300
2026-09-28T23:18:30.533Z [ERROR] [MyModule] Connection failed host=example.com
```

Extra data follows as `key=value` pairs. With color on, the level tag is cyan for `debug`, green for `info`, yellow for `warn` and red for `error`.

### JSON Format

Set `SIGNALWIRE_LOG_FORMAT=json` for one JSON object per line, with the extra data as top-level keys:

```json
{"timestamp":"2026-09-28T23:18:31.550Z","level":"warn","logger":"MyModule","message":"Token expiring soon","expiresIn":300}
```

### Context Binding with `bind()`

`bind()` returns a logger that adds the given fields to every line:

<!-- snippet: no-run illustrative fragment: references the assumed `getLogger` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const log = getLogger('Handler');

const requestLog = log.bind({ requestId: '456', callId: 'abc-123' });
requestLog.info('Handling request');
// 2026-09-28T22:57:03.529Z [INFO] [Handler] Handling request requestId=456 callId=abc-123
```

### Programmatic Configuration

These functions change the logging configuration for the whole process:

```typescript
import {
  setGlobalLogLevel,
  suppressAllLogs,
  setGlobalLogFormat,
  setGlobalLogColor,
  resetLoggingConfiguration,
} from '@signalwire/sdk';

// Change the level at runtime
setGlobalLogLevel('debug');

// Silence all output; suppressAllLogs(false) turns it back on
suppressAllLogs(true);

// Switch to JSON lines
setGlobalLogFormat('json');

// Force color on or off
setGlobalLogColor(false);

// Re-read the environment variables and drop every change made in code
resetLoggingConfiguration();
```

`new AgentServer()` calls `setGlobalLogLevel()` with its `logLevel` option, `info` by default, so it replaces the level `SIGNALWIRE_LOG_LEVEL` set. Pass `logLevel` to choose it.

---

## Priority Order

No single rule covers every setting. This table gives the order for each one, highest first:

| Setting | Resolution |
|---|---|
| Port (`AgentBase`) | `port` option, config file `service.port`, `PORT`, `3000` |
| Port (`SWMLService`, `AgentServer`) | `port` option, `PORT`, `3000` |
| Port (`WebService`) | `port` option, config file `service.port`, `8002` |
| Route and host (`AgentBase`) | constructor option, config file `service.route` or `service.host`, `/` or `0.0.0.0` |
| Basic auth (`AgentBase`, `SWMLService`) | `basicAuth` option, config file password, `SWML_BASIC_AUTH_PASSWORD`, generated |
| Basic auth (`WebService`) | `basicAuth` option, otherwise none |
| Log level | `setGlobalLogLevel()` (including through `new AgentServer()`), `SIGNALWIRE_LOG_LEVEL`, `info` |
| CORS origins | `SWML_CORS_ORIGINS`, `*`. `AgentBase`, `SWMLService`, `AgentServer` and `WebService` read it. |
| Allowed hosts, rate limit, request size, CSRF | Environment variables only, applied by `AgentBase` |
| Proxy URL | The most recent of `SWML_PROXY_URL_BASE` (read at construction) and `manualSetProxyUrl()`. Header detection, when `SWML_TRUST_PROXY_HEADERS=true`, replaces the base URL on each request unless `SWML_PROXY_URL_BASE` is set. Without any of them, the serverless platform's URL, or `http://{host}:{port}`. |
| SSL (`SWMLService.serve()`) | `serve()` options, config file `security.ssl`, `SWML_SSL_ENABLED` / `SWML_SSL_CERT_PATH` / `SWML_SSL_KEY_PATH` |
| SSL (`WebService.start()`) | `start()` certificate and key arguments, `ssl` option, `SWML_SSL_ENABLED` / `SWML_SSL_CERT_PATH` / `SWML_SSL_KEY_PATH` |
| SWAIG token secret | `swaigSecret` option, `SIGNALWIRE_SWAIG_SECRET`, random per process |
| Webhook signing key | `signingKey` option, `SIGNALWIRE_SIGNING_KEY`, none |
