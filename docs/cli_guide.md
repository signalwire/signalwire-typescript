# CLI Guide

Complete guide to the `swaig-test` command-line tool for testing SignalWire AI agents locally without making a phone call.

---

## Table of Contents

- [Overview](#overview)
- [Installation and Usage](#installation-and-usage)
- [Agent Discovery](#agent-discovery)
  - [Discovery Order](#discovery-order)
  - [The --agent-class Flag](#the---agent-class-flag)
- [Commands](#commands)
  - [--dump-swml](#--dump-swml)
  - [--list-tools](#--list-tools)
  - [--exec function_name](#--exec-function_name)
  - [--list-agents](#--list-agents)
- [Execution Options](#execution-options)
  - [Function Arguments (--arg)](#function-arguments---arg)
  - [Call Metadata Overrides](#call-metadata-overrides)
  - [Post Data Overrides (--override)](#post-data-overrides---override)
- [Mock Data](#mock-data)
  - [Full Mock Post Data](#full-mock-post-data)
  - [Minimal Mock Post Data](#minimal-mock-post-data)
  - [MockCallOptions](#mockcalloptions)
- [Output Formatting](#output-formatting)
- [Route Override](#route-override)
- [Environment Variables](#environment-variables)
- [Serverless Simulation](#serverless-simulation)
- [Examples](#examples)

---

## Overview

`swaig-test` is a CLI tool for testing SignalWire AI agents locally. It dynamically imports your agent module, generates mock call data, and lets you:

- **Dump the SWML document** your agent produces, so you can inspect its full configuration.
- **List all registered tools** with their descriptions and parameter schemas.
- **Execute a specific tool** with custom arguments and inspect the result.
- **List all agents** exported from a module file.

This allows you to iterate on your agent's configuration, prompt, and tool handlers without setting up a phone number, making a call, or deploying to a server.

**Source files:**

- `src/cli/swaig-test.ts` -- CLI entry point and argument parser.
- `src/cli/agent-loader.ts` -- Agent discovery via dynamic import with duck-typing.
- `src/cli/mock-data.ts` -- Mock call data generation.

---

## Installation and Usage

Run the CLI via `npx tsx` during development:

```bash
npx tsx src/cli/swaig-test.ts <agent-path> [options]
```

If the project has been built, you can run the compiled JavaScript directly:

```bash
node dist/cli/swaig-test.js <agent-path> [options]
```

The `<agent-path>` is the path to your agent module file (TypeScript or JavaScript). It is the first positional argument and is required for all commands except `--help`.

Show help:

```bash
npx tsx src/cli/swaig-test.ts --help
```

---

## Agent Discovery

The CLI uses dynamic `import()` to load your agent module, then applies a series of duck-typing heuristics to find an `AgentBase` instance. An object is considered an agent instance if it has `renderSwml`, `defineTool`, and `getPrompt` methods. A constructor function is considered an agent class if its `prototype` has those same methods.

### Discovery Order

When no `--agent-class` flag is provided, the loader tries these strategies in order and uses the first match:

| Priority | Strategy | Description |
|---|---|---|
| 1 | Named export `agent` (instance) | Checks `module.agent` and verifies it is an agent instance via duck-typing. |
| 2 | Default export (instance) | Checks `module.default` and verifies it is an agent instance. |
| 3 | Any exported instance | Iterates over all exports; uses the first agent instance found. |
| 4 | Default export (class) | If `module.default` is an agent class, instantiates it with `{ name: 'cli-agent' }`. |
| 5 | Any exported class | Iterates over all exports; instantiates the first agent class found with `{ name: 'cli-agent' }`. |

### The --agent-class Flag

Force the CLI to instantiate a specific class by name:

```bash
npx tsx src/cli/swaig-test.ts my-agents.ts --agent-class SalesAgent --dump-swml
```

The loader looks for a named export matching the class name and instantiates it.

---

## Commands

### --dump-swml

Render and print the full SWML document the agent produces. This includes the complete 5-phase call flow, all tool definitions, the prompt, hints, languages, and all AI configuration.

```bash
npx tsx src/cli/swaig-test.ts examples/simple_agent.ts --dump-swml
```

Output is pretty-printed JSON.

### --list-tools

List all registered tools with their descriptions, parameter schemas, and metadata. Shows both handler-based tools (`defineTool()`) and DataMap tools.

```bash
npx tsx src/cli/swaig-test.ts examples/simple_agent.ts --list-tools
```

Example output:

```
Tools registered on agent 'my-agent':

1. get_weather
   Description: Get the current weather for a city
   Parameters:
     city (string, required): City name
     units (string, optional): Temperature units [celsius, fahrenheit]

2. check_order (DataMap)
   Description: Check order status
   Parameters:
     order_id (string, required): Order number
```

### --exec function_name

Execute a specific tool handler with the provided arguments and display the result.

```bash
npx tsx src/cli/swaig-test.ts examples/simple_agent.ts \
  --exec get_weather \
  --arg city=Austin \
  --arg units=fahrenheit
```

### --list-agents

List all agent classes and instances exported from a module.

```bash
npx tsx src/cli/swaig-test.ts examples/multi_agent_server.ts --list-agents
```

```bash
# With verbose details
npx tsx src/cli/swaig-test.ts examples/multi_agent_server.ts --list-agents --verbose
```

---

## Execution Options

### Function Arguments (--arg)

Pass arguments as `key=value` pairs:

```bash
--arg city=Austin --arg units=fahrenheit
```

For JSON values:

```bash
--arg data='{"nested":"value"}'
```

Arguments are parsed as strings by default. The CLI attempts JSON parsing for values that look like objects or arrays.

### Call Metadata Overrides

Override fields in the mock call data:

```bash
# Override the caller ID
--caller-id "+15551234567"

# Override the call direction
--direction inbound

# Override the SIP from address
--from-addr "sip:user@example.com"
```

### Post Data Overrides (--override)

Override specific fields in the mock post_data using dot notation:

```bash
--override "call.call_id=custom-call-123"
--override "call.from=+15559876543"
--override "metadata.tenant=acme"
```

---

## Mock Data

### Full Mock Post Data

By default, `swaig-test` generates a comprehensive mock post_data payload that simulates a real SignalWire SWAIG request:

```typescript
{
  function: 'get_weather',
  argument: { city: 'Austin' },
  call_id: 'mock-call-uuid',
  call: {
    call_id: 'mock-call-uuid',
    node_id: 'mock-node-uuid',
    segment_id: 'mock-segment-uuid',
    from: '+15551234567',
    to: '+15559876543',
    direction: 'inbound',
    type: 'phone',
    state: 'answered',
  },
  meta_data: {},
  caller_id_name: 'Mock Caller',
  caller_id_number: '+15551234567',
}
```

### Minimal Mock Post Data

Use `--minimal` to generate a stripped-down post_data with only the essential fields:

```bash
npx tsx src/cli/swaig-test.ts my-agent.ts --exec get_weather --arg city=Austin --minimal
```

### MockCallOptions

The mock data generator accepts options for customizing the simulated call:

| Option | Type | Description |
|--------|------|-------------|
| `callId` | `string` | Custom call ID. |
| `from` | `string` | Caller number. |
| `to` | `string` | Destination number. |
| `direction` | `string` | `"inbound"` or `"outbound"`. |
| `callerIdName` | `string` | Caller display name. |
| `sipFrom` | `string` | SIP From address. |

---

## Output Formatting

### Default (Human-Readable)

The default output is formatted for readability with section headers, colored output, and indented JSON.

### --json

Output raw JSON for machine processing:

```bash
npx tsx src/cli/swaig-test.ts my-agent.ts --exec get_weather --arg city=Austin --json
```

### --verbose

Enable detailed execution tracing. Shows the full request payload, handler execution details, and timing information. Also enables SDK logging output.

```bash
npx tsx src/cli/swaig-test.ts my-agent.ts --exec get_weather --arg city=Austin --verbose
```

---

## Route Override

When testing an agent that uses a non-root route, specify the route:

```bash
npx tsx src/cli/swaig-test.ts my-agents.ts --route /support --dump-swml
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SIGNALWIRE_LOG_LEVEL` | Set log verbosity (`debug`, `info`, `warn`, `error`). Default: suppressed unless `--verbose`. |
| `SIGNALWIRE_LOG_MODE` | Set to `"off"` to fully suppress logs. Default: suppressed unless `--verbose`. |

The CLI automatically suppresses SDK logs unless `--verbose` is specified.

---

## Serverless Simulation

Test agents deployed as serverless functions by simulating the platform environment:

```bash
# Simulate AWS Lambda
npx tsx src/cli/swaig-test.ts my-agent.ts --serverless lambda --dump-swml

# Simulate Google Cloud Functions
npx tsx src/cli/swaig-test.ts my-agent.ts --serverless gcf --exec my_tool --arg key=val

# Simulate Azure Functions
npx tsx src/cli/swaig-test.ts my-agent.ts --serverless azure --dump-swml

# Simulate CGI
npx tsx src/cli/swaig-test.ts my-agent.ts --serverless cgi --list-tools
```

The serverless simulation sets up the appropriate environment variables and request format for each platform.

---

## Examples

### Dump the SWML Document

```bash
npx tsx src/cli/swaig-test.ts examples/simple_agent.ts --dump-swml
```

```json
{
  "version": "1.0.0",
  "sections": {
    "main": [
      { "answer": {} },
      {
        "ai": {
          "prompt": { "text": "You are a helpful assistant." },
          "SWAIG": {
            "functions": [
              {
                "function": "get_weather",
                "description": "Get current weather",
                "parameters": { ... }
              }
            ]
          }
        }
      }
    ]
  }
}
```

### List Registered Tools

```bash
npx tsx src/cli/swaig-test.ts examples/skills_demo.ts --list-tools
```

### Execute a Tool

```bash
# Execute with named arguments
npx tsx src/cli/swaig-test.ts examples/simple_agent.ts \
  --exec get_weather \
  --arg city=Austin \
  --arg units=fahrenheit

# Execute with verbose output
npx tsx src/cli/swaig-test.ts examples/simple_agent.ts \
  --exec get_weather \
  --arg city=Austin \
  --verbose
```

### Test with Custom Caller Data

```bash
npx tsx src/cli/swaig-test.ts examples/simple_dynamic_agent.ts \
  --dump-swml \
  --caller-id "+15551234567" \
  --override "call.direction=outbound"
```

### Simulate a SIP Call

```bash
npx tsx src/cli/swaig-test.ts examples/room_and_sip_example.ts \
  --dump-swml \
  --from-addr "sip:sales@company.com"
```

### Test with Environment Variables

```bash
WEATHER_API_KEY=abc123 npx tsx src/cli/swaig-test.ts \
  examples/simple_agent.ts \
  --exec get_weather \
  --arg city=Austin
```

### Machine-Readable Output

```bash
npx tsx src/cli/swaig-test.ts examples/simple_agent.ts \
  --exec get_weather \
  --arg city=Austin \
  --json
```

### Discover Agents in a File

```bash
# Just run the file with no other flags to discover agents
npx tsx src/cli/swaig-test.ts examples/multi_agent_server.ts

# Or explicitly list agents
npx tsx src/cli/swaig-test.ts examples/multi_agent_server.ts --list-agents
```

### Test a Specific Agent Class

```bash
npx tsx src/cli/swaig-test.ts examples/multi_agent_server.ts \
  --agent-class SupportAgent \
  --dump-swml
```

### Test a DataMap Tool

```bash
npx tsx src/cli/swaig-test.ts examples/data_map_demo.ts \
  --exec get_weather \
  --arg city=Austin \
  --verbose
```

DataMap tools are automatically detected and simulated -- the CLI makes real HTTP requests using the DataMap's webhook configuration, processes the response through the output template, and displays the result.
