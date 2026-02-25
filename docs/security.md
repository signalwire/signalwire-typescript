# Security

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [SSL/TLS](#ssltls)
- [Security Headers](#security-headers)
- [CORS](#cors)
- [Rate Limiting](#rate-limiting)
- [Host Validation](#host-validation)
- [Request Size Limits](#request-size-limits)
- [Secure Tools (HMAC Tokens)](#secure-tools-hmac-tokens)
- [Production Checklist](#production-checklist)

---

## Overview

The SignalWire AI Agents TypeScript SDK provides multiple layers of security, applied automatically or via configuration:

- **Authentication** -- Basic auth on all agent routes (always enabled), plus optional bearer token, API key, and custom validation via `AuthHandler`.
- **SSL/TLS** -- HTTPS with HSTS support via `SslConfig`.
- **Security headers** -- `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, and `Referrer-Policy` on every response.
- **CORS** -- Configurable origin restrictions via `SWML_CORS_ORIGINS`.
- **Rate limiting** -- Per-IP request throttling via `SWML_RATE_LIMIT`.
- **Host validation** -- Hostname allowlist via `SWML_ALLOWED_HOSTS`.
- **Request size limits** -- Maximum payload size via `SWML_MAX_REQUEST_SIZE`.
- **Secure tools** -- Per-function HMAC-signed tokens that bind tool calls to specific call sessions.

---

## Authentication

### Basic Auth (Default)

Every `AgentBase` instance applies Hono's `basicAuth` middleware to all routes (`/`, `/swaig`, `/post_prompt`, `/debug_events`). Credentials are resolved in the following order:

1. **Constructor option** -- `basicAuth: ['username', 'password']` in `AgentOptions`.
2. **Environment variables** -- `SWML_BASIC_AUTH_USER` and `SWML_BASIC_AUTH_PASSWORD` (both must be set).
3. **Auto-generated** -- the agent name as the username and a random 16-character hex string as the password.

```typescript
import { AgentBase } from '@anthropic/signalwire-agents';

// Explicit credentials
const agent = new AgentBase({
  name: 'my-agent',
  basicAuth: ['admin', 'hunter2'],
});

// Environment-based: set SWML_BASIC_AUTH_USER and SWML_BASIC_AUTH_PASSWORD
const agent2 = new AgentBase({ name: 'my-agent' });

// Auto-generated: credentials are logged at startup
const agent3 = new AgentBase({ name: 'my-agent' });
// Logs: Auth: my-agent:**** (source: generated)
```

To inspect credentials and their source at runtime:

```typescript
const [user, pass] = agent.getBasicAuthCredentials();
const [user2, pass2, source] = agent.getBasicAuthCredentials(true);
// source: 'provided' | 'environment' | 'generated'
```

### Custom Basic Auth Validation

Override `validateBasicAuth()` in a subclass to add custom validation logic beyond credential matching:

```typescript
class SecureAgent extends AgentBase {
  validateBasicAuth(username: string, password: string): boolean {
    // Block specific users
    if (username === 'blocked') return false;
    // Optionally query a database, check IP allowlists, etc.
    return true;
  }
}
```

### AuthHandler (Multi-Method)

For advanced use cases beyond basic auth, `AuthHandler` (`src/AuthHandler.ts`) supports multiple authentication methods with timing-safe credential comparison to prevent timing attacks:

```typescript
import { AuthHandler } from '@anthropic/signalwire-agents';

const auth = new AuthHandler({
  // Method 1: Bearer token (Authorization: Bearer <token>)
  bearerToken: 'my-secret-token',

  // Method 2: API key (X-Api-Key: <key>)
  apiKey: 'my-api-key-123',

  // Method 3: Basic auth (Authorization: Basic <base64>)
  basicAuth: ['admin', 'password'],

  // Method 4: Custom validator
  customValidator: async (req) => {
    return req.headers['x-internal-service'] === 'trusted';
  },
});
```

**Validation order:** Methods are checked in order (Bearer, API Key, Basic, Custom). The first successful match allows the request. If no methods are configured, all requests pass (backwards compatibility).

**Using as Hono middleware:**

```typescript
const app = new Hono();
app.use('/api/*', auth.middleware());
// Returns 401 JSON response: { "error": "Unauthorized" }
```

**Timing-safe comparison:** All credential checks use `crypto.timingSafeEqual` to prevent timing attacks. When string lengths differ, a dummy comparison is performed to avoid leaking length information.

---

## SSL/TLS

The `SslConfig` class (`src/SslConfig.ts`) manages SSL/TLS configuration for HTTPS serving.

### Configuration

SSL can be configured via constructor options or environment variables:

```typescript
import { SslConfig } from '@anthropic/signalwire-agents';

// Via constructor
const ssl = new SslConfig({
  enabled: true,
  certPath: '/etc/ssl/certs/agent.pem',
  keyPath: '/etc/ssl/private/agent-key.pem',
  domain: 'agent.example.com',
  hsts: true,         // default: true
  hstsMaxAge: 31536000, // default: 31536000 (1 year)
});
```

**Or via environment variables:**

| Variable | Description |
|---|---|
| `SWML_SSL_ENABLED` | Set to `"true"` to enable SSL. |
| `SWML_SSL_CERT_PATH` | Path to the PEM-encoded certificate file. |
| `SWML_SSL_KEY_PATH` | Path to the PEM-encoded private key file. |
| `SWML_SSL_DOMAIN` | Domain name for HSTS headers. |

Environment variables are used as fallbacks when constructor options are not provided.

### SslOptions Interface

| Property | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `false` | Whether SSL is enabled. |
| `certPath` | `string` | -- | Path to the PEM certificate file. |
| `keyPath` | `string` | -- | Path to the PEM private key file. |
| `domain` | `string` | -- | Domain name for HSTS. |
| `hsts` | `boolean` | `true` | Whether to emit HSTS headers. |
| `hstsMaxAge` | `number` | `31536000` | HSTS `max-age` value in seconds (1 year). |

### Verification and Usage

```typescript
// Check if SSL is fully configured (enabled + cert + key exist on disk)
if (ssl.isConfigured()) {
  // Get Node.js https.createServer() options
  const serverOpts = ssl.getServerOptions();
  // { cert: '...', key: '...' }
}

// Get the HSTS header value
const hsts = ssl.getHstsHeader();
// "max-age=31536000; includeSubDomains" (or null if disabled)
```

### HSTS Middleware

Apply HSTS headers to all responses via Hono middleware:

```typescript
const ssl = new SslConfig({ enabled: true, certPath: '...', keyPath: '...' });
app.use('*', ssl.hstsMiddleware());
// Adds: Strict-Transport-Security: max-age=31536000; includeSubDomains
```

---

## Security Headers

Both `AgentBase` and `AgentServer` automatically apply the following security headers to every HTTP response:

| Header | Value | Purpose |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevents browsers from MIME-sniffing the response away from the declared content type. |
| `X-Frame-Options` | `DENY` | Prevents the page from being embedded in frames (clickjacking protection). |
| `X-XSS-Protection` | `1; mode=block` | Enables the browser's built-in XSS filter (legacy browsers). |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls how much referrer information is sent with requests. |

These headers are applied automatically via Hono middleware and require no configuration. They are set in both `AgentBase.getApp()` and `AgentServer`'s constructor.

---

## CORS

By default, the SDK uses a permissive CORS policy that allows all origins (`*`). This is suitable for development but should be restricted in production.

### Restricting Origins

Set the `SWML_CORS_ORIGINS` environment variable to a comma-separated list of allowed origins:

```bash
export SWML_CORS_ORIGINS="https://app.example.com,https://admin.example.com"
```

When set, only requests from the listed origins will receive CORS headers. All other cross-origin requests will be blocked by the browser.

### Implementation Details

CORS is applied via Hono's built-in `cors()` middleware with `credentials: true`:

```typescript
// Internal implementation in AgentBase.getApp()
const corsOrigins = process.env['SWML_CORS_ORIGINS'];
const corsOrigin = corsOrigins ? corsOrigins.split(',').map(o => o.trim()) : '*';
app.use('*', cors({ origin: corsOrigin, credentials: true }));
```

`AgentServer` uses `origin: '*'` by default. For multi-agent deployments, set `SWML_CORS_ORIGINS` when using standalone `AgentBase` instances.

---

## Rate Limiting

Set the `SWML_RATE_LIMIT` environment variable to enable per-IP request throttling:

```bash
# Allow 60 requests per minute per IP address
export SWML_RATE_LIMIT=60
```

### Behavior

- Tracking is per-IP, using `X-Forwarded-For` (first IP), `X-Real-IP`, or `"unknown"` as fallback.
- The counter resets every 60 seconds per IP.
- When the limit is exceeded, the server responds with HTTP `429`:

```json
{ "error": "Rate limit exceeded" }
```

### Example

```bash
# Set a conservative limit for production
export SWML_RATE_LIMIT=120

# Or a very low limit for testing
export SWML_RATE_LIMIT=5
```

Rate limiting is only enabled when `SWML_RATE_LIMIT` is set to a positive integer. When unset, no rate limiting is applied.

---

## Host Validation

Set `SWML_ALLOWED_HOSTS` to restrict which `Host` header values are accepted:

```bash
export SWML_ALLOWED_HOSTS="agent.example.com,api.example.com"
```

### Behavior

- The `Host` header is extracted from each request, the port is stripped, and the hostname is compared (case-insensitive) against the allowlist.
- If the hostname is not in the list, the server responds with HTTP `403`:

```json
{ "error": "Forbidden: host not allowed" }
```

- When `SWML_ALLOWED_HOSTS` is not set, host validation is disabled and all hostnames are accepted.

### Use Cases

- Prevent DNS rebinding attacks.
- Ensure the agent only responds to requests addressed to known hostnames.
- Useful behind reverse proxies to block direct IP-based access.

---

## Request Size Limits

Set `SWML_MAX_REQUEST_SIZE` to limit the maximum allowed request body size:

```bash
# Limit to 512 KB
export SWML_MAX_REQUEST_SIZE=524288
```

### Behavior

- The `Content-Length` header is checked against the configured maximum.
- Requests exceeding the limit receive HTTP `413`:

```json
{ "error": "Request too large" }
```

- Default limit: `1048576` bytes (1 MB).

---

## Secure Tools (HMAC Tokens)

The `SessionManager` (`src/SessionManager.ts`) provides stateless HMAC-SHA256 token generation and validation for SWAIG function calls. This ensures that tool invocations are cryptographically bound to specific call sessions.

### How It Works

1. When `renderSwml()` is called, a unique session token is generated for each function marked as `secure: true`.
2. The token is appended to the function's webhook URL as a `__token` query parameter.
3. When the platform invokes the function, the agent validates the token before executing the handler.

### Token Format

Tokens are base64url-encoded strings with the following internal structure:

```
base64url( callId.functionName.expiry.nonce.hmacSignature )
```

| Field | Description |
|---|---|
| `callId` | The call ID this token is bound to. |
| `functionName` | The SWAIG function name this token authorizes. |
| `expiry` | Unix timestamp (seconds) when the token expires. |
| `nonce` | Random 8-character hex string for uniqueness. |
| `hmacSignature` | First 16 hex characters of the HMAC-SHA256 signature over `callId:functionName:expiry:nonce`. |

### Defining Secure Tools

```typescript
agent.defineTool({
  name: 'transfer_funds',
  description: 'Transfer money between accounts',
  parameters: {
    type: 'object',
    properties: {
      amount: { type: 'number', description: 'Amount to transfer' },
      toAccount: { type: 'string', description: 'Destination account ID' },
    },
  },
  secure: true,  // Enables HMAC token protection
  handler: async (args, rawData) => {
    // Only reachable with a valid, unexpired token
    const result = new SwaigFunctionResult();
    result.setResponse('Transfer completed.');
    return result;
  },
});
```

### Token Lifecycle

- **Generation**: `sessionManager.generateToken(functionName, callId)` creates a token with the configured expiry (default: 3600 seconds / 1 hour).
- **Validation**: `sessionManager.validateToken(callId, functionName, token)` verifies the HMAC signature, checks expiry, and confirms the call ID and function name match.
- **No server-side state**: Tokens are self-contained. The server does not store token state; validation is purely cryptographic.

### Configuring Token Expiry

```typescript
const agent = new AgentBase({
  name: 'my-agent',
  tokenExpirySecs: 7200, // 2 hours
});
```

### Debugging Tokens

```typescript
import { SessionManager } from '@anthropic/signalwire-agents';

const sm = new SessionManager(3600);
const token = sm.generateToken('my_function', 'call-123');

// Decode without validating (for debugging)
const info = sm.debugToken(token);
// { callId: 'call-123', functionName: 'my_function', expiry: 1737000000,
//   nonce: 'a1b2c3d4', signature: '...', expired: false }
```

### Session Metadata

`SessionManager` also provides per-session metadata storage:

```typescript
const sm = new SessionManager();

sm.setSessionMetadata('session-1', { userId: 'u-42', plan: 'pro' });
const meta = sm.getSessionMetadata('session-1');
// { userId: 'u-42', plan: 'pro' }

sm.deleteSessionMetadata('session-1');
```

---

## Production Checklist

Follow these best practices when deploying agents to production:

- [ ] **Set explicit basic-auth credentials** -- Do not rely on auto-generated passwords. Use `basicAuth` in the constructor or set `SWML_BASIC_AUTH_USER` and `SWML_BASIC_AUTH_PASSWORD` environment variables.

- [ ] **Enable SSL/TLS** -- Set `SWML_SSL_ENABLED=true` with valid `SWML_SSL_CERT_PATH` and `SWML_SSL_KEY_PATH`, or terminate TLS at your reverse proxy / load balancer.

- [ ] **Restrict CORS origins** -- Set `SWML_CORS_ORIGINS` to your specific frontend domains instead of allowing all origins.

- [ ] **Enable rate limiting** -- Set `SWML_RATE_LIMIT` to a reasonable value (e.g., `120` requests/minute) to prevent abuse.

- [ ] **Configure allowed hosts** -- Set `SWML_ALLOWED_HOSTS` to your expected domain names to block DNS rebinding and direct IP access.

- [ ] **Review request size limits** -- Adjust `SWML_MAX_REQUEST_SIZE` if your use case requires larger or smaller payloads than the 1 MB default.

- [ ] **Use secure tools for sensitive operations** -- Mark tools that perform privileged actions (payments, transfers, data mutations) with `secure: true`.

- [ ] **Set the proxy URL** -- If behind a reverse proxy, set `SWML_PROXY_URL_BASE` to ensure webhook URLs use the correct external address.

- [ ] **Reduce log verbosity** -- Set `SIGNALWIRE_LOG_LEVEL=warn` or `error` in production to avoid logging sensitive request data.

- [ ] **Rotate secrets** -- The HMAC signing key for `SessionManager` is generated randomly on each process start. For multi-instance deployments, provide a shared secret key or use short token expiry times.

- [ ] **Monitor health endpoints** -- Use the unauthenticated `/health` and `/ready` endpoints for load balancer health checks.
