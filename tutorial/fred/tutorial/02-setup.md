# Lesson 2: Setting Up Your Environment

Fred needs Node.js and the SignalWire SDK. This lesson creates the project directory the rest of the tutorial uses, installs the SDK and the TypeScript tools in it, and checks that they work.

## Table of Contents

1. [Prerequisites Check](#prerequisites-check)
2. [Creating the Project](#creating-the-project)
3. [Installing the SDK](#installing-the-sdk)
4. [Verifying Installation](#verifying-installation)
5. [Understanding Dependencies](#understanding-dependencies)
6. [Project Structure](#project-structure)
7. [Environment Variables](#environment-variables)
8. [Common Installation Issues](#common-installation-issues)

---

## Prerequisites Check

The SDK needs Node.js 22.18 or later, and npm to install it. From 22.18, Node.js can load a TypeScript file itself, and the SDK's `swaig-test` tool relies on that in [Lesson 6](06-running-testing.md).

### Required Software

Check your Node.js version:

```bash
node --version
```

The output should show version 22.18 or later:

```text
v24.18.0
```

Check that npm is installed:

```bash
npm --version
```

## Creating the Project

Fred's files live in one directory, which is also an npm project. Create it:

```bash
mkdir fred-bot
cd fred-bot
npm init -y
npm pkg set type=module
```

`npm init -y` writes a `package.json` with default values. `npm pkg set type=module` makes Node.js treat the project's files as ES modules. Fred needs that for `import`, and for `await` at the top level of a file.

## Installing the SDK

With the project created, install the SDK from npm.

### Basic Installation

One command installs the SDK:

```bash
npm install @signalwire/sdk
```

### TypeScript Tools

Three development packages run and check TypeScript. Install them as development dependencies:

```bash
npm install --save-dev tsx typescript @types/node
```

Each package has a role:

- `tsx`: runs a TypeScript file without a build step, as in `npx tsx fred.ts`
- `typescript`: the `tsc` compiler, which checks types and compiles Fred to JavaScript for [Appendix B](appendix-docker-deployment.md)
- `@types/node`: type definitions for Node.js itself

### The tsconfig.json File

`tsc` reads its settings from `tsconfig.json`. Create it in the project directory with these settings:

<!-- copy of: tutorial/fred/tsconfig.json -->
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "types": ["node"],
    "outDir": "dist"
  },
  "files": ["fred.ts"]
}
```

`strict` turns on TypeScript's full type checks. `outDir` is where `tsc` writes the compiled `fred.js`, and `files` names the one file to compile. `fred.ts` doesn't exist yet, so `tsc` has nothing to check until [Lesson 3](03-basic-agent.md).

## Verifying Installation

A short script confirms that the SDK imports and can create an agent. Create a file called `check-setup.ts`:

```typescript
// Check that this machine is ready to build Fred
import { versions } from 'node:process';

const [major = 0, minor = 0] = versions.node.split('.').map(Number);
if (major > 22 || (major === 22 && minor >= 18)) {
  console.log(`OK       Node.js ${versions.node}`);
} else {
  console.log(`MISSING  Node.js ${versions.node} (need 22.18 or later)`);
  process.exitCode = 1;
}

try {
  // Import the SDK and create an agent. Nothing starts a server.
  const { AgentBase } = await import('@signalwire/sdk');
  const agent = new AgentBase({ name: 'Test Agent', route: '/test' });
  console.log(`OK       SignalWire SDK (created '${agent.getName()}' at ${agent.route})`);
} catch (err) {
  console.log(`MISSING  SignalWire SDK: ${err instanceof Error ? err.message : String(err)}`);
  console.log('         Run: npm install @signalwire/sdk');
  process.exitCode = 1;
}
```

Run the script with `SIGNALWIRE_LOG_MODE=off`, which keeps the SDK's startup warnings out of the output. [Lesson 6](06-running-testing.md#important-information) explains those warnings.

```bash
SIGNALWIRE_LOG_MODE=off npx tsx check-setup.ts
```

The output confirms both parts:

```text
OK       Node.js 24.18.0
OK       SignalWire SDK (created 'Test Agent' at /test)
```

`npm ls` shows the installed version of the SDK:

```bash
npm ls @signalwire/sdk
```

The output names the project and the version:

```text
fred-bot@1.0.0 /home/you/fred-bot
└── @signalwire/sdk@3.5.0
```

You can delete `check-setup.ts` once it passes.

## Understanding Dependencies

The SDK installs a small set of packages with it:

- `hono`: the web framework behind the agent's HTTP endpoints
- `@hono/node-server`: runs a Hono app on Node.js's HTTP server
- `ajv`: checks SWML and function arguments against their JSON schemas
- `js-yaml`: reads and writes prompts as YAML
- `ws`: the WebSocket client behind the SDK's RELAY client

Fetching from Wikipedia uses the `fetch` function built into Node.js, so the Wikipedia skill needs no extra package. A few other skills do. The `web_search` and `spider` skills need `cheerio`, for example. Fred doesn't use them.

## Project Structure

By the end of the tutorial, the directory holds these files:

```text
fred-bot/
├── fred.ts            # The agent
├── fred.sh            # Management script (Lesson 6)
├── package.json       # The project and its dependencies
├── package-lock.json  # The exact versions npm installed
├── tsconfig.json      # TypeScript settings
└── node_modules/      # The installed packages
```

### The package.json File

After the installs, `package.json` lists the SDK and the three tools. Replace the defaults `npm init` wrote with this version, which adds a description, the Node.js version Fred needs, and three scripts:

<!-- copy of: tutorial/fred/package.json -->
```json
{
  "name": "fred-bot",
  "version": "1.0.0",
  "private": true,
  "description": "Fred, a voice agent that answers questions from Wikipedia",
  "type": "module",
  "scripts": {
    "start": "tsx fred.ts",
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "engines": {
    "node": ">=22.18.0"
  },
  "dependencies": {
    "@signalwire/sdk": "^3.5.0"
  },
  "devDependencies": {
    "@types/node": "^22.20.4",
    "tsx": "^4.23.15",
    "typescript": "^7.0.2"
  }
}
```

The scripts are shortcuts. `npm start` runs Fred with `tsx`, and `npm run build` compiles it into `dist/`. `npm run typecheck` checks its types without writing any files. Commit `package-lock.json` with the rest of the project, so that `npm ci` installs the same versions everywhere, including in the Docker images in [Appendix B](appendix-docker-deployment.md).

## Environment Variables

The SDK reads a few optional environment variables.

### Authentication

Without these, the SDK generates a random password each time the agent starts, and uses the agent's name, `Fred`, as the username:

```bash
export SWML_BASIC_AUTH_USER="fred"
export SWML_BASIC_AUTH_PASSWORD="a-long-random-password"
```

### Port

Fred listens on port 3000 by default. If something else uses that port, choose another:

```bash
export PORT=3001
```

### Proxy Configuration

When Fred runs behind a proxy or a tunnel such as ngrok, tell the SDK its public address:

```bash
export SWML_PROXY_URL_BASE="https://your-domain.com"
```

## Common Installation Issues

Most installation problems have one of three causes.

### Issue: Node.js Is Too Old

Before version 22.18, Node.js can't load a TypeScript file itself, so `swaig-test` fails on `fred.ts`:

```text
Error: Failed to import agent file: /home/you/fred-bot/fred.ts
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts" for /home/you/fred-bot/fred.ts
```

Install a current release from [nodejs.org](https://nodejs.org/), or with a version manager such as nvm:

```bash
nvm install 24
nvm use 24
```

### Issue: Top-Level Await Isn't Supported

If `package.json` has no `"type": "module"`, `tsx` compiles `fred.ts` as CommonJS, and the `await` at the top of the file fails:

```text
ERROR: Top-level await is currently not supported with the "cjs" output format
```

Set the module type, then run Fred again:

```bash
npm pkg set type=module
```

### Issue: Cannot Find the Package

Node.js can't find the SDK when it isn't installed in the project that runs the file:

```text
Cannot find package '@signalwire/sdk' imported from /home/you/fred-bot/check-setup.ts
```

Run `npm install` from the project directory, the one that holds `package.json`, and run Fred from there too.

## Next Steps

Before you continue, check that:

- Node.js 22.18 or later is installed
- The project directory has `package.json` with `"type": "module"`, and `tsconfig.json`
- The SDK and the TypeScript tools are installed
- `check-setup.ts` passes

Next, create Fred's agent class. Continue with [Lesson 3: Creating Fred's Basic Structure](03-basic-agent.md).

---

[Previous: Introduction](01-introduction.md) | [Overview](README.md) | [Next: Basic Agent](03-basic-agent.md)
