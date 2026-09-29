# WebService Documentation

The `WebService` class serves static files from local directories over HTTP or HTTPS. It's built on [Hono](https://hono.dev/) and runs on its own port, standalone or next to your agents.

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module (top-level await)
declare global {
  const WebService: typeof import('@signalwire/sdk').WebService;
}
```

## Table of Contents
- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Security Features](#security-features)
- [HTTPS/SSL Support](#httpsssl-support)
- [API Endpoints](#api-endpoints)
- [Usage Examples](#usage-examples)
- [Deployment Patterns](#deployment-patterns)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)
- [Integration with SignalWire Agents](#integration-with-signalwire-agents)

## Overview

`WebService` serves files from local directories, each at its own URL prefix. You can use it to serve:
- Audio files that an agent's SWML plays
- Documentation, API specs and reports
- Static assets such as images, CSS and JavaScript

It has these features:
- Several directories, each mounted at its own URL prefix
- Optional HTTP Basic Authentication, CORS and security headers
- An allowlist and a blocklist of file extensions, and a maximum file size
- Optional HTML directory listings
- A content type chosen from the file extension
- HTTPS from PEM certificate and key files

## Installation

`WebService` is part of the SignalWire SDK package:

```bash
npm install @signalwire/sdk
```

The package requires Node.js 22 or later.

## Quick Start

This service serves two directories on port 8002:

<!-- snippet: no-run starts a blocking HTTP file server via service.start() -->
```typescript
import { WebService } from '@signalwire/sdk';

// Create a service to serve files
const service = new WebService({
  port: 8002,
  directories: {
    '/docs': './documentation',
    '/assets': './static/assets',
  },
});

// Start the service
await service.start();
// Service available at http://localhost:8002
```

If `SWML_BASIC_AUTH_PASSWORD` is set in the environment, the service requires HTTP Basic Authentication with it. See [Basic Authentication](#basic-authentication).

## Configuration

Constructor options override values from a config file. For each setting, the constructor option wins, then the config file, then the default.

### 1. Constructor Options

The constructor takes a `WebServiceOptions` object:

```typescript
const service = new WebService({
  port: 8002,                          // Port to bind to (default 8002)
  directories: {                       // URL prefix to directory mappings
    '/docs': './documentation',
    '/assets': './static',
  },
  basicAuth: ['admin', 'a-long-random-password'], // [username, password]
  enableDirectoryBrowsing: true,       // Allow directory listings
  allowedExtensions: ['.html', '.css', '.js'], // Allowlist extensions
  blockedExtensions: ['.env', '.key'],          // Replaces the default blocklist
  maxFileSize: 100 * 1024 * 1024,      // Max file size (100 MB)
  enableCors: true,                    // Enable CORS headers (default true)
});
```

### 2. Environment Variables

`WebService` reads these environment variables:

```bash
# Basic auth credentials, used when neither the basicAuth option nor the config file sets them
export SWML_BASIC_AUTH_USER="admin"         # defaults to signalwire
export SWML_BASIC_AUTH_PASSWORD="a-long-random-password"

# SSL/HTTPS configuration (via SslConfig), used when the ssl option doesn't set them
export SWML_SSL_ENABLED=true
export SWML_SSL_CERT_PATH="/path/to/cert.pem"
export SWML_SSL_KEY_PATH="/path/to/key.pem"

# CORS origins (comma-separated; defaults to *)
export SWML_CORS_ORIGINS="https://app.example.com"
```

It doesn't read `PORT`; set the `port` option or the config file's `service.port`.

### 3. Configuration File

Pass `configFile` to load a JSON file. The values under the `service` key map to the constructor options:

```json
{
  "service": {
    "port": 8002,
    "directories": {
      "/docs": "./documentation",
      "/api": "./api-specs",
      "/reports": "./generated/reports"
    },
    "enableDirectoryBrowsing": true,
    "maxFileSize": 52428800,
    "allowedExtensions": [".html", ".css", ".js", ".json", ".pdf"],
    "blockedExtensions": [".env", ".key", ".pem"],
    "enableCors": true
  }
}
```

This constructor loads that file:

```typescript
const service = new WebService({ configFile: './web_service.json' });
```

The file can set credentials under `security.auth.basic` (`{"user": ..., "password": ...}`), but not `ssl`. Directories from the file and from the `directories` option are merged, and the option wins for the same prefix. Relative directory paths resolve against the process's working directory. A `configFile` that is missing or isn't valid JSON is skipped with a warning.

Without `configFile`, the constructor looks for `web_service.json` in the working directory, `./config/`, `~/.signalwire/`, `./.swml/`, `~/.swml/` and `/etc/swml/`, and loads the first one it finds. If that file isn't valid JSON, the constructor logs a warning and starts from its other settings. See [Search Paths](configuration.md#search-paths) in the configuration guide.

## Security Features

### Basic Authentication

The service takes its credentials from the first of these that sets a password:

1. The `basicAuth: ['username', 'password']` option
2. The config file's `security.auth.basic` `user` and `password`
3. The `SWML_BASIC_AUTH_USER` and `SWML_BASIC_AUTH_PASSWORD` environment variables

The user defaults to `signalwire` when only a password is set. With credentials, every route requires HTTP Basic Authentication, including `/health`. Without any, the service serves every route without authentication, and doesn't generate a password.

### File Security

#### Default Blocked Extensions and Files

The default blocklist refuses these files:
- `.env`, `.git`, `.gitignore`
- `.key`, `.pem`, `.crt`
- `.pyc`, `__pycache__`
- `.DS_Store`, `.swp`

An entry that starts with a dot matches a file extension or a whole file name. Any other entry matches a file name, or any part of the file's full path. Passing `blockedExtensions` replaces the default list, so include the defaults you still want.

The blocklist and `allowedExtensions` apply both to the path in the request and to the file actually read. A symbolic link inside the mount, such as `alias.txt` pointing to `.env` or into a `__pycache__` directory, gets `403` like the file it points to.

#### Path Traversal Protection

`WebService` refuses a path containing `..` with `403`, and checks that the resolved path is inside the mounted directory. A `..` segment in a request URL is resolved when the URL is parsed, before routing, so `GET /docs/../../etc/passwd` becomes `GET /etc/passwd`. That path matches no mount and gets `404`.

The check follows symbolic links. A link inside a mounted directory serves its target only when the target is also inside the directory; a link to a file or directory outside it gets `403`. A directory listing doesn't show symbolic links.

#### File Size Limits

A file larger than `maxFileSize` gets `403`, like a blocked file type. The default maximum is 100 MB. This service sets 50 MB:

```typescript
const service = new WebService({ maxFileSize: 50 * 1024 * 1024 }); // 50 MB
```

### Security Headers

Every response carries these headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`, when SSL is configured through the `ssl` option or the `SWML_SSL_ENABLED`, `SWML_SSL_CERT_PATH` and `SWML_SSL_KEY_PATH` variables

With `enableCors` (the default), CORS allows the origins in `SWML_CORS_ORIGINS`, or any origin when it's unset or lists `*`.

## HTTPS/SSL Support

`WebService` serves HTTPS when SSL is enabled and both the certificate and the key files exist. If either file is missing, it serves plain HTTP. `start()` logs the scheme it uses.

### Method 1: Environment Variables

`SslConfig` reads the SSL settings from the environment:

```bash
export SWML_SSL_ENABLED=true
export SWML_SSL_CERT_PATH="/path/to/cert.pem"
export SWML_SSL_KEY_PATH="/path/to/key.pem"
```

### Method 2: Constructor `ssl` Option

The `ssl` option sets the same values. A field it leaves out falls back to its environment variable:

<!-- snippet: no-run starts a blocking HTTP file server via service.start() -->
```typescript
const service = new WebService({
  directories: { '/docs': './docs' },
  ssl: { enabled: true, certPath: '/path/to/cert.pem', keyPath: '/path/to/key.pem' },
});
await service.start();
// Service available at https://localhost:8002
```

### Method 3: `start()` Parameters

`start(host, port, sslCert, sslKey)` takes the certificate and key paths directly. They replace the other SSL settings for that server:

<!-- snippet: no-run starts a blocking HTTP file server via service.start() -->
```typescript
const service = new WebService({ directories: { '/docs': './docs' } });
await service.start('0.0.0.0', 8002, '/path/to/cert.pem', '/path/to/key.pem');
```

With this method alone, responses don't carry the `Strict-Transport-Security` header, because that header depends on the `ssl` option or the environment variables.

### Generating Self-Signed Certificates

For development and testing, `openssl` can create a self-signed certificate:

```bash
# Generate a self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem \
    -days 365 -nodes -subj "/CN=localhost"

# Use with WebService
export SWML_SSL_ENABLED=true
export SWML_SSL_CERT_PATH="cert.pem"
export SWML_SSL_KEY_PATH="key.pem"
```

## API Endpoints

### GET /health

`GET /health` reports the service's configuration. It requires authentication when the service has credentials.

**Response:**
```json
{
  "status": "healthy",
  "directories": ["/docs", "/assets"],
  "sslEnabled": false,
  "authRequired": true,
  "directoryBrowsing": true
}
```

### GET /

`GET /` returns an HTML page that links to each mounted directory. With no directories, it returns `{"service":"SignalWire Web Service","directories":[]}`.

### GET /{route}/{filePath}

`GET` on a mounted prefix serves a file from that directory. `route` is the mounted prefix (for example, `/docs`), and `filePath` is the path of a file inside the directory.

**Response:**
- The file, with a content type from its extension (`application/octet-stream` for an unknown one) and `Cache-Control: public, max-age=3600`
- `404` if the file doesn't exist
- `403` if the path contains `..`, resolves (through a symbolic link) to a file outside the mounted directory, or the file is blocked, isn't allowed, or is larger than `maxFileSize`
- For a directory: with `enableDirectoryBrowsing`, an HTML listing of its subdirectories and allowed files, without dot files. Without it, the directory's `index.html` if that exists and is allowed, otherwise `403`.

## Usage Examples

### Basic File Serving

This service serves two directories on the default port:

<!-- snippet: no-run starts a blocking HTTP file server via service.start() -->
```typescript
import { WebService } from '@signalwire/sdk';

// Serve documentation
const service = new WebService({
  directories: {
    '/docs': './documentation',
    '/api': './api-specs',
  },
});
await service.start();

// Files accessible at:
// http://localhost:8002/docs/index.html
// http://localhost:8002/api/swagger.json
```

### With Directory Browsing

This service lists the contents of `./public`:

<!-- snippet: no-run starts a blocking HTTP file server via service.start() -->
```typescript
const service = new WebService({
  directories: { '/files': './public' },
  enableDirectoryBrowsing: true, // Allow browsing directories
});
await service.start();

// Browse files at: http://localhost:8002/files/
```

### Restricted File Types

This service serves only web assets:

```typescript
// Only serve web assets
const service = new WebService({
  directories: { '/web': './www' },
  allowedExtensions: ['.html', '.css', '.js', '.png', '.jpg', '.woff2'],
  enableDirectoryBrowsing: false,
});
```

### Dynamic Directory Management

`addDirectory()` mounts a directory after construction, and `removeDirectory()` unmounts one. Both work on a running service and take effect from the next request.

<!-- snippet: no-run starts a blocking HTTP file server via service.start() -->
```typescript
const service = new WebService();
service.addDirectory('/docs', './documentation');
await service.start();

// Later, while the service runs
service.addDirectory('/reports', './generated/reports');
service.removeDirectory('/docs'); // GET /docs/... now returns 404
```

When prefixes overlap, the longest one that matches the request path serves it. A directory mounted at `/` serves every path except `/` and `/health`.

`addDirectory()` throws if the directory doesn't exist or isn't a directory.

### With Custom Authentication

This service requires basic auth on every route:

<!-- snippet: no-run starts a blocking HTTP file server via service.start() -->
```typescript
const service = new WebService({
  directories: { '/private': './sensitive-docs' },
  basicAuth: ['admin', 'a-long-random-password'],
});
await service.start();
```

### HTTPS with an Existing Certificate

This service uses certificate files from a certificate authority, passed to `start()`:

<!-- snippet: no-run starts a blocking HTTP file server via service.start() -->
```typescript
const service = new WebService({
  directories: { '/secure': './secure-files' },
});
await service.start(
  '0.0.0.0',
  8002,
  '/etc/letsencrypt/live/example.com/fullchain.pem',
  '/etc/letsencrypt/live/example.com/privkey.pem',
);
// Service available at https://example.com:8002
```

### Multi-Environment Configuration

This setup serves HTTPS in production and a browsable directory in development:

<!-- snippet: no-run starts a blocking HTTP file server via service.start() -->
```typescript
import { WebService } from '@signalwire/sdk';

let service: WebService;

if (process.env.NODE_ENV === 'production') {
  service = new WebService({
    port: 443,
    directories: { '/': './dist' },
    enableDirectoryBrowsing: false,
    ssl: {
      enabled: true,
      certPath: '/etc/ssl/certs/production.crt',
      keyPath: '/etc/ssl/private/production.key',
    },
  });
} else {
  service = new WebService({
    port: 8002,
    directories: { '/': './src' },
    enableDirectoryBrowsing: true,
  });
}

await service.start();
```

## Deployment Patterns

### Standalone Service

This script (`web-server.ts`) runs `WebService` as a dedicated static file server:

<!-- snippet: no-run starts a blocking HTTP file server via service.start() -->
```typescript
import { WebService } from '@signalwire/sdk';

const service = new WebService({
  port: 8002,
  directories: {
    '/docs': '/var/www/docs',
    '/assets': '/var/www/assets',
    '/downloads': '/var/www/downloads',
  },
});

await service.start();
```

### Alongside AI Agents

This script (`main.ts`) runs `WebService` on one port and an agent on another:

<!-- snippet: no-run starts a blocking HTTP file server via service.start() -->
```typescript
import { AgentBase, WebService } from '@signalwire/sdk';

// Start WebService for documentation on port 8002
const web = new WebService({
  port: 8002,
  directories: { '/docs': './agent-docs' },
});
await web.start();

// Run the agent on port 3000
const agent = new AgentBase({ name: 'My Agent' });
agent.setPromptText('You are a helpful assistant.');
await agent.serve({ port: 3000 });
```

### Docker Deployment

This Dockerfile runs the compiled `web-server.ts` from the standalone example. It assumes you compile it to `dist/web-server.js` before the build:

```dockerfile
FROM node:22-slim

WORKDIR /app

# Install dependencies (including @signalwire/sdk)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy app + static files
COPY ./dist ./dist
COPY ./static /app/static
COPY ./web_service.json /app/web_service.json

# Expose port
EXPOSE 8002

# Run WebService
CMD ["node", "dist/web-server.js"]
```

The service finds `/app/web_service.json` because the working directory is `/app`.

### Nginx Reverse Proxy

For production, Nginx in front of the service can terminate TLS:

```nginx
server {
    listen 80;
    server_name static.example.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name static.example.com;

    ssl_certificate /etc/ssl/certs/example.com.crt;
    ssl_certificate_key /etc/ssl/private/example.com.key;

    location / {
        proxy_pass http://localhost:8002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Best Practices

These practices apply to a production deployment:

1. Serve HTTPS, from the service or from a proxy in front of it.
2. Set credentials (the `basicAuth` option or `SWML_BASIC_AUTH_PASSWORD`) for anything that isn't public. Without them, every file the service can read is public.
3. Use `allowedExtensions` to serve only the file types you intend.
4. Turn off directory browsing.
5. Mount only directories whose contents you control.
6. Tune `maxFileSize`, and use a CDN for large or busy static assets.

## API Reference

### WebService Class

The class has these public members:

<!-- snippet: no-compile class API-signature reference (declaration-only, no bodies), not runnable -->
```typescript
class WebService {
  constructor(options?: WebServiceOptions);

  readonly port: number;
  readonly directories: Record<string, string>;
  readonly enableDirectoryBrowsing: boolean;
  readonly allowedExtensions: string[] | null;
  readonly blockedExtensions: string[];
  readonly maxFileSize: number;
  readonly enableCors: boolean;

  addDirectory(route: string, directory: string): void;
  removeDirectory(route: string): void;
  getApp(): Hono;
  get sslConfig(): SslConfig;
  start(host?: string, port?: number, sslCert?: string, sslKey?: string): Promise<void>;
  stop(): void;
}
```

#### WebServiceOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `8002` | Port to bind to. |
| `directories` | `Record<string, string>` | `{}` | URL prefix to local directory mappings. |
| `basicAuth` | `[string, string]` | config file, then environment | `[username, password]` for basic auth. |
| `configFile` | `string` | none | Path to a JSON config file. Without it, the constructor searches for `web_service.json`. |
| `enableDirectoryBrowsing` | `boolean` | `false` | Serve HTML listings for directories. |
| `allowedExtensions` | `string[]` | all | Allowlist of file extensions, such as `.html`. |
| `blockedExtensions` | `string[]` | (defaults) | Blocklist of extensions and names. Replaces the default list. |
| `maxFileSize` | `number` | `104857600` | Maximum file size in bytes (100 MB). |
| `enableCors` | `boolean` | `true` | Add CORS headers. |
| `ssl` | `SslOptions` | none | SSL settings: `enabled`, `certPath`, `keyPath`, `domain`, `hsts`, `hstsMaxAge`. |

#### Methods

These methods manage the service:

- `addDirectory(route, directory)`: Mount a directory at a URL prefix, before or after the service starts. Throws if the directory doesn't exist or isn't a directory.
- `removeDirectory(route)`: Unmount the prefix. Its route returns `404` from the next request.
- `getApp()`: Return the underlying Hono app, to mount or test.
- `start(host?, port?, sslCert?, sslKey?)`: Start the HTTP or HTTPS server. `host` defaults to `0.0.0.0`. With `SWAIG_CLI_MODE=true`, it does nothing.
- `stop()`: Stop the server.

## Integration with SignalWire Agents

An agent can point callers or the model at files the service serves. This agent's tool returns a documentation link, and the agent and the service run in the same process on different ports:

<!-- snippet: no-run starts a blocking HTTP file server via service.start() -->
```typescript
import { AgentBase, FunctionResult, WebService } from '@signalwire/sdk';

class DocumentationAgent extends AgentBase {
  protected override defineTools(): void {
    this.defineTool({
      name: 'get_doc_link',
      description: 'Get a link to a documentation page.',
      parameters: {
        doc_name: { type: 'string', description: 'Name of the documentation page' },
      },
      required: ['doc_name'],
      handler: (args) =>
        new FunctionResult(
          `Documentation available at: https://example.com:8002/docs/${args.doc_name}.html`,
        ),
    });
  }
}

// Start WebService for documentation
const web = new WebService({ port: 8002, directories: { '/docs': './documentation' } });
await web.start();

// Start the agent
const agent = new DocumentationAgent({ name: 'Documentation Assistant' });
agent.promptAddSection('Documentation', {
  body: 'User documentation is available at https://example.com:8002/docs/',
});
await agent.serve({ port: 3000 });
```

The tool's response is context for the model, not speech: the model decides how to pass the link on. For audio, a SWML `play` verb, or a `FunctionResult` action such as `playBackgroundFile()`, can use a URL the service serves.
