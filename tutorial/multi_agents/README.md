# SignalWire Agents SDK Tutorial: Multi-Agent PC Builder

This tutorial builds AI voice agents with the SignalWire Agents SDK for TypeScript. It starts with a single sales agent and ends with a multi-agent system that searches a knowledge base and hands off calls between specialists.

## Table of Contents

1. [What you build](#what-you-build)
2. [Prerequisites](#prerequisites)
3. [Tutorial structure](#tutorial-structure)
4. [Getting started](#getting-started)
5. [Additional resources](#additional-resources)

---

## What you build

The tutorial builds PC Builder Pro, a store with three voice agents:

- Morgan, a sales specialist who recommends builds from a product knowledge base
- Sam, a support specialist who troubleshoots from a support knowledge base
- Alex, a front desk agent who greets callers and transfers them to Morgan or Sam

Along the way it covers these topics:

- Creating an agent with `AgentBase` and a structured prompt (the Prompt Object Model, or POM)
- Configuring voices and languages, and serving over HTTPS
- Adding a knowledge-base search tool with the `native_vector_search` skill
- Hosting several agents on one `AgentServer`, and transferring calls between them
- Writing SWAIG functions (the tools the AI calls), handling errors, and deploying
- Writing custom skills, keeping state, and calling external services

## Prerequisites

You need these to follow the tutorial:

- Node.js 22.13 or later. Lesson 5's SQLite example uses `node:sqlite`, which Node.js 22.5 through 22.12 offer only behind the `--experimental-sqlite` flag.
- npm, and a basic knowledge of TypeScript, including `async` and `await`
- A text editor

A SignalWire account lets you call the agents from a phone, but every lesson also works without one.

## Tutorial structure

Each lesson builds on the one before it:

1. [Lesson 1: Creating Your First Agent](lesson1_first_agent.md) builds Morgan, a sales agent with a structured prompt and a voice. It covers running the agent locally and over HTTPS.
2. [Lesson 2: Adding Intelligence with Knowledge Bases](lesson2_knowledge_bases.md) gives Morgan a search tool over a Markdown knowledge base.
3. [Lesson 3: Building Multi-Agent Systems](lesson3_multi_agent_systems.md) hosts Alex, Morgan and Sam on one server, with transfers that carry the caller's name and a summary.
4. [Lesson 4: Advanced Features and Best Practices](lesson4_advanced_features.md) covers SWAIG functions, error handling, logging, testing and deployment.
5. [Lesson 5: Extending Your Agents](lesson5_extending_agents.md) covers custom skills, state, workflows and external services.

## Getting started

The commands in this tutorial run from the root of the SDK repository, where `@signalwire/sdk` resolves to the source tree. Install the dependencies once:

```bash
npm install
```

In a project of your own, install the SDK and `tsx`, which runs TypeScript files directly:

```bash
npm install @signalwire/sdk
npm install --save-dev tsx
```

### Running your first agent

Every request to an agent needs basic auth. Set the credentials, then start the Lesson 1 agent:

```bash
export SWML_BASIC_AUTH_USER=devuser
export SWML_BASIC_AUTH_PASSWORD=devpassword
npx tsx tutorial/multi_agents/sales_agent.ts
```

The agent listens on port 3000, or on the port in the `PORT` environment variable.

### Testing with SWML

From a second terminal, request the agent's SWML document with the same credentials:

```bash
curl -u devuser:devpassword http://localhost:3000/
```

## Additional resources

### Quick reference

These commands come up throughout the tutorial:

```bash
# List an agent's tools, and call one without starting a server
npx tsx src/cli/swaig-test.ts tutorial/multi_agents/sales_agent_with_search.ts --list-tools
npx tsx src/cli/swaig-test.ts tutorial/multi_agents/sales_agent_with_search.ts --exec search_sales_knowledge --query "RTX 4070"

# Print the SWML one agent of a multi-agent file serves
npx tsx src/cli/swaig-test.ts tutorial/multi_agents/pc_builder.ts --route /sales --dump-swml

# Serve HTTPS
SWML_SSL_ENABLED=true \
SWML_SSL_CERT_PATH=/path/to/cert.pem \
SWML_SSL_KEY_PATH=/path/to/key.pem \
npx tsx tutorial/multi_agents/sales_agent.ts
```

In a project that installs the SDK, run the CLI as `npx swaig-test`.

The agents read these environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port to listen on | `3000` (`3001` for `pc_builder.ts`) |
| `SWML_BASIC_AUTH_USER` | Basic auth username | The agent's name |
| `SWML_BASIC_AUTH_PASSWORD` | Basic auth password | Generated at startup, and never logged |
| `SWML_SSL_ENABLED` | Serve HTTPS: `true`, `1` or `yes` | Off |
| `SWML_SSL_CERT_PATH` | Path to the PEM certificate | None |
| `SWML_SSL_KEY_PATH` | Path to the PEM private key | None |
| `SWML_SSL_DOMAIN` | Domain the agent's webhook URLs use when it serves HTTPS | None |
| `SWML_PROXY_URL_BASE` | Public URL of the agent, when a proxy or tunnel is in front of it | None |
| `SIGNALWIRE_SIGNING_KEY` | Key that verifies requests come from SignalWire | None |
| `SIGNALWIRE_LOG_LEVEL` | `debug`, `info`, `warn` or `error` | `info` |

### Code examples

This directory holds every file the lessons build:

- `sales_agent.ts`: the basic sales agent (Lesson 1)
- `knowledge.ts` and `sales_agent_with_search.ts`: the knowledge-base loader and the agent that searches it (Lesson 2)
- `pc_builder.ts`: the multi-agent system (Lesson 3)
- `advanced_agent.ts` and `Dockerfile`: the tools and deployment from Lesson 4
- `extending_agents.ts`: the skills and patterns from Lesson 5
- `sales_knowledge.md` and `support_knowledge.md`: the two knowledge bases

The tests in `tests/tutorial/multi_agents.test.ts` and `tests/tutorial/multi_agents-lessons.test.ts` check what the lessons say about each file. Run them with `npx vitest run tests/tutorial/multi_agents`.

### Troubleshooting

These problems come up most often:

1. **Port already in use:** another process holds the port. Start the agent on a different one:

   ```bash
   PORT=3002 npx tsx tutorial/multi_agents/sales_agent.ts
   ```

2. **401 Unauthorized from curl:** the credentials don't match the agent's. Set `SWML_BASIC_AUTH_USER` and `SWML_BASIC_AUTH_PASSWORD` before starting the agent. Without them the agent generates a password it doesn't log.
3. **`Cannot find module '@signalwire/sdk'`:** install the dependencies with `npm install`, and run the commands from the project root.

### Getting help

For more information, see the [SignalWire documentation](https://signalwire.com/docs) and the SDK guides in [`docs/`](../../docs/agent-guide.md).

These habits help when you debug an agent:

- Test tools with `swaig-test` before you place a call.
- Request the SWML with `curl` to see exactly what SignalWire receives.
- Set `SIGNALWIRE_LOG_LEVEL=debug` for more detail in the logs.

### Best practices checklist

Check these before you put an agent in front of callers:

- Structure prompts with sections, and describe every tool and parameter precisely
- Return a `FunctionResult` that tells the model what happened, including failures
- Test locally with `swaig-test` and your own tests
- Serve HTTPS, or put the agent behind a proxy that does
- Set the basic auth credentials and `SIGNALWIRE_SIGNING_KEY` from the environment
- Keep secrets out of prompts and logs, and validate every argument a tool receives
- Keep your dependencies up to date

---

Start with [Lesson 1: Creating Your First Agent](lesson1_first_agent.md).
