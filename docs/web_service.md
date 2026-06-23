# WebService Documentation

The `WebService` class provides static file serving for the SignalWire AI Agents TypeScript SDK. It is a thin, security-conscious HTTP server built on [Hono](https://hono.dev/) that can run standalone or alongside your AI agents.

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

## Overview

WebService serves static files with configurable security features. It is useful for:
- Serving agent documentation and API specs
- Hosting static assets (images, CSS, JavaScript)
- Serving generated reports and exports
- Providing configuration files and templates
- Hosting audio files referenced by an agent's SWML

### Key Features
- **Multiple directory mounting** - Serve different directories at different URL paths
- **Security-first design** - Authentication, CORS, security headers, file filtering
- **HTTPS support** - Full SSL/TLS support with PEM files
- **Directory browsing** - Optional HTML directory listings
- **MIME type handling** - Automatic content-type detection
- **Path traversal protection** - Prevents access outside designated directories
- **File filtering** - Allow/block specific file extensions

## Installation

WebService is included in the core SignalWire AI Agents SDK:

```bash
npm install @signalwire/sdk
```

It requires Node.js >= 22.

## Quick Start

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

`WebService` does not auto-generate basic-auth credentials. Auth is enabled only
when you pass `basicAuth` or set the `SWML_BASIC_AUTH_USER` /
`SWML_BASIC_AUTH_PASSWORD` environment variables.

## Configuration

WebService can be configured through multiple methods (in order of priority):
constructor options override values loaded from a config file.

### 1. Constructor Options

```typescript
const service = new WebService({
  port: 8002,                          // Port to bind to (default 8002)
  directories: {                       // URL path to directory mappings
    '/docs': './documentation',
    '/assets': './static',
  },
  basicAuth: ['admin', 'secret'],      // Custom [username, password] auth
  enableDirectoryBrowsing: true,       // Allow directory listings
  allowedExtensions: ['.html', '.css', '.js'], // Allowlist extensions
  blockedExtensions: ['.env', '.key'],          // Blocklist extensions
  maxFileSize: 100 * 1024 * 1024,      // Max file size (100 MB)
  enableCors: true,                    // Enable CORS headers (default true)
});
```

### 2. Environment Variables

```bash
# Basic authentication
export SWML_BASIC_AUTH_USER="admin"
export SWML_BASIC_AUTH_PASSWORD="secretpassword"

# SSL/HTTPS configuration (via SslConfig)
export SWML_SSL_ENABLED=true
export SWML_SSL_CERT="/path/to/cert.pem"
export SWML_SSL_KEY="/path/to/key.pem"

# CORS origins (comma-separated; defaults to *)
export SWML_CORS_ORIGINS="https://app.example.com"
```

### 3. Configuration File

Pass `configFile` to load a JSON file. Values under the `service` key map to the
constructor options:

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

```typescript
const service = new WebService({ configFile: './web_service.json' });
```

## Security Features

### Basic Authentication

WebService implements HTTP Basic Authentication. Credentials can be set via:

1. **Constructor**: `basicAuth: ['username', 'password']`
2. **Environment**: `SWML_BASIC_AUTH_USER` and `SWML_BASIC_AUTH_PASSWORD`

If no credentials are provided, the service runs without authentication.

### File Security

#### Default Blocked Extensions/Files
- `.env`, `.git`, `.gitignore`
- `.key`, `.pem`, `.crt`
- `.pyc`, `__pycache__`
- `.DS_Store`, `.swp`

#### Path Traversal Protection
WebService rejects any request whose path contains `..` and double-checks that
the resolved path stays within the mounted directory:

```text
# These attempts return 403 Forbidden:
# GET /docs/../../../etc/passwd
# GET /docs/./././../config.json
```

#### File Size Limits
The default maximum file size is 100 MB. Configure it with:

```typescript
const service = new WebService({ maxFileSize: 50 * 1024 * 1024 }); // 50 MB
```

### Security Headers

Security headers are added to every response:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`
- `Strict-Transport-Security` (when HTTPS is enabled)

## HTTPS/SSL Support

WebService provides multiple ways to enable HTTPS.

### Method 1: Environment Variables

SSL configuration is read from the environment via `SslConfig`:

```bash
export SWML_SSL_ENABLED=true
export SWML_SSL_CERT="/path/to/cert.pem"
export SWML_SSL_KEY="/path/to/key.pem"
```

### Method 2: Constructor `ssl` option

```typescript
const service = new WebService({
  directories: { '/docs': './docs' },
  ssl: { enabled: true, certPath: '/path/to/cert.pem', keyPath: '/path/to/key.pem' },
});
await service.start();
// Service available at https://localhost:8002
```

### Method 3: `start()` parameters

Pass the cert and key paths directly to `start(host, port, sslCert, sslKey)`:

```typescript
const service = new WebService({ directories: { '/docs': './docs' } });
await service.start('0.0.0.0', 8002, '/path/to/cert.pem', '/path/to/key.pem');
```

### Generating Self-Signed Certificates

For development/testing:

```bash
# Generate a self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem \
    -days 365 -nodes -subj "/CN=localhost"

# Use with WebService
export SWML_SSL_ENABLED=true
export SWML_SSL_CERT="cert.pem"
export SWML_SSL_KEY="key.pem"
```

## API Endpoints

### GET /health
Health check endpoint (no authentication required when auth is disabled).

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
Root endpoint showing available directories.

**Response:** HTML page listing all mounted directories.

### GET /{route}/{filePath}
Serve files from mounted directories.

**Parameters:**
- `route`: The mounted directory route (e.g., `/docs`)
- `filePath`: Path to a file within the directory

**Response:**
- File content with the appropriate MIME type
- 404 if the file is not found
- 403 if the file type is blocked or directory browsing is disabled

## Usage Examples

### Basic File Serving

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

```typescript
const service = new WebService({
  directories: { '/files': './public' },
  enableDirectoryBrowsing: true, // Allow browsing directories
});
await service.start();

// Browse files at: http://localhost:8002/files/
```

### Restricted File Types

```typescript
// Only serve web assets
const service = new WebService({
  directories: { '/web': './www' },
  allowedExtensions: ['.html', '.css', '.js', '.png', '.jpg', '.woff2'],
  enableDirectoryBrowsing: false,
});
```

### Dynamic Directory Management

```typescript
const service = new WebService();

// Add directories after construction
service.addDirectory('/docs', './documentation');
service.addDirectory('/reports', './generated/reports');

// Remove a directory route
service.removeDirectory('/reports');

await service.start();
```

### With Custom Authentication

```typescript
const service = new WebService({
  directories: { '/private': './sensitive-docs' },
  basicAuth: ['admin', 'super-secret-password'],
});
await service.start();
```

### HTTPS with Let's Encrypt

```typescript
// Assuming you have Let's Encrypt certificates
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

```typescript
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

Run WebService as a dedicated static file server (`web-server.ts`):

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

Run WebService alongside your AI agent on a different port (`main.ts`):

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

### Nginx Reverse Proxy

For production, put Nginx in front as a reverse proxy:

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

### Security
1. **Always use HTTPS in production** - Protect data in transit.
2. **Set explicit credentials** - Provide `basicAuth` or the auth env vars in production.
3. **Restrict file types** - Use `allowedExtensions` to allowlist safe files.
4. **Disable directory browsing** - Turn it off in production environments.
5. **Use a reverse proxy** - Put Nginx/Apache in front for additional security.

### Performance
1. **Cache headers** - WebService adds a 1-hour `Cache-Control` header by default.
2. **Limit file sizes** - Adjust `maxFileSize` based on your needs.
3. **Use a CDN for static assets** - Offload traffic for better performance.

### Organization
1. **Separate content types** - Use different routes for different file types.
2. **Version your assets** - Include a version in the path (e.g., `/assets/v1/`).
3. **Use index.html** - Provide a default file for each directory.

## API Reference

### WebService Class

```typescript
class WebService {
  constructor(options?: WebServiceOptions);

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
| `directories` | `Record<string, string>` | `{}` | URL route prefix to local directory mappings. |
| `basicAuth` | `[string, string]` | none | `[username, password]` for basic auth. |
| `configFile` | `string` | none | Path to a JSON config file. |
| `enableDirectoryBrowsing` | `boolean` | `false` | Allow directory listings. |
| `allowedExtensions` | `string[]` | all | Allowlist of file extensions. |
| `blockedExtensions` | `string[]` | (defaults) | Blocklist of file extensions/names. |
| `maxFileSize` | `number` | `104857600` | Maximum file size in bytes (100 MB). |
| `enableCors` | `boolean` | `true` | Enable CORS headers. |
| `ssl` | `SslOptions` | none | SSL/TLS configuration. |

#### Methods

- `addDirectory(route, directory)` — Mount a new directory at a route prefix. Throws if the directory does not exist.
- `removeDirectory(route)` — Stop tracking a route (a restart is required for Hono to fully drop the route).
- `getApp()` — Return the underlying Hono app for mounting or testing.
- `start(host?, port?, sslCert?, sslKey?)` — Start the HTTP(S) server.
- `stop()` — Stop the server and release resources.

## Integration with SignalWire Agents

WebService complements AI agents by serving static assets:

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

## Summary

WebService provides a secure, configurable static file server that integrates with the
SignalWire AI Agents SDK. It follows the same security patterns as `AgentBase` and
`SWMLService`, making it familiar and easy to use alongside your voice agents.
