# swaig-test CLI Guide

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
  - [Dump the SWML Document](#dump-the-swml-document)
  - [List Registered Tools](#list-registered-tools)
  - [Execute a Tool](#execute-a-tool)
  - [Test with Custom Caller Data](#test-with-custom-caller-data)
  - [Simulate a SIP Call](#simulate-a-sip-call)
  - [Test with Environment Variables](#test-with-environment-variables)
  - [Machine-Readable Output](#machine-readable-output)
  - [Discover Agents in a File](#discover-agents-in-a-file)

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

If none of these strategies succeed, the CLI throws an error with guidance:

```
Could not find an AgentBase instance or subclass in /path/to/file.
Export your agent as `export const agent = new AgentBase(...)` or as default export.
```

**Recommended export patterns:**

```typescript
// Pattern 1: Named export (highest priority)
export const agent = new MyAgent({ name: 'my-agent' });

// Pattern 2: Default export (instance)
export default new MyAgent({ name: 'my-agent' });

// Pattern 3: Default export (class -- will be auto-instantiated)
export default MyAgent;
```

### The --agent-class Flag

When `--agent-class <name>` is provided, the loader skips the discovery order and looks up the specific named export:

```bash
npx tsx src/cli/swaig-test.ts my-agents.ts --agent-class SalesAgent
```

If the named export is an instance, it is used directly. If it is a class, it is instantiated with `{ name: '<name_lowercased>' }`. An error is thrown if the export is not found or is not an agent.

---

## Commands

### --dump-swml

Generate and output the SWML document the agent would serve in response to an incoming call.

```bash
npx tsx src/cli/swaig-test.ts my-agent.ts --dump-swml
```

This is the **default action** -- if no action flag is specified, the CLI dumps SWML.

The command generates mock call POST data (simulating an inbound WebRTC call by default), passes it to `agent.renderSwml()`, and prints the resulting JSON document.

### --list-tools

List all SWAIG functions registered on the agent, including their descriptions and parameter schemas.

```bash
npx tsx src/cli/swaig-test.ts my-agent.ts --list-tools
```

For each tool, the output shows:
- **Name** -- the tool's function name.
- **Description** -- the human-readable description used by the AI model.
- **Parameters** -- the JSON Schema object describing the tool's input parameters.

### --exec function_name

Execute a specific SWAIG function handler and display the result.

```bash
npx tsx src/cli/swaig-test.ts my-agent.ts --exec search_faq --arg query="password reset"
```

The command:
1. Looks up the tool by name. If not found, prints an error with available function names.
2. Generates minimal mock POST data for function execution.
3. Calls `tool.execute(args, postData)` with the arguments provided via `--arg`.
4. Prints the result as JSON.

### --list-agents

List all exported agents (instances and classes) found in a module file.

```bash
npx tsx src/cli/swaig-test.ts my-agents.ts --list-agents
```

This scans all named exports and reports which ones are agent instances or agent classes. Useful when a single file exports multiple agents and you need to know the export names for `--agent-class`.

---

## Execution Options

### Function Arguments (--arg)

Pass arguments to a SWAIG function when using `--exec`. Each `--arg` takes a `key=value` pair. The flag is repeatable for multiple arguments.

```bash
npx tsx src/cli/swaig-test.ts my-agent.ts --exec save_field \
  --arg field_name=email \
  --arg value=user@example.com
```

Values are parsed as JSON first; if parsing fails, the raw string is used. This means you can pass numbers, booleans, and objects:

```bash
# String value (JSON parse fails, used as string)
--arg name=Alice

# Numeric value (JSON parse succeeds)
--arg count=42

# Boolean value (JSON parse succeeds)
--arg required=true

# JSON object value
--arg data='{"nested":"value"}'
```

### Call Metadata Overrides

These flags control the mock call metadata used when generating POST data:

| Flag | Type | Default | Description |
|---|---|---|---|
| `--call-type` | `sip \| webrtc` | `webrtc` | Call transport type. Affects `caller_id_name`, `channel_type`, and `sip_headers`. |
| `--call-direction` | `inbound \| outbound` | `inbound` | Direction of the call. |
| `--call-state` | `string` | `active` | Current call state (e.g., `active`, `ringing`, `hold`). |
| `--call-id` | `string` | Random UUID | Override the auto-generated call ID. |
| `--from-number` | `string` | `+15551234567` | Caller's phone number. |
| `--to-extension` | `string` | `test-agent` | Destination extension or agent name. |

### Post Data Overrides (--override)

Merge arbitrary key-value pairs into the generated POST data. Repeatable. Values are JSON-parsed when possible.

```bash
npx tsx src/cli/swaig-test.ts my-agent.ts --dump-swml \
  --override project_id=my-project-123 \
  --override vars='{"custom_flag":true}'
```

Overrides are applied via `Object.assign` after the mock data is generated, so they can replace any auto-generated field.

---

## Mock Data

The CLI generates fake POST data that simulates what SignalWire would send to your agent's webhook endpoint. Two generators are available.

### Full Mock Post Data

Used by `--dump-swml` and `--simulate-serverless`. Generated by `generateFakePostData()`.

The full mock POST body includes:

| Field | Description |
|---|---|
| `call_id` | Random UUID (or overridden via `--call-id`). |
| `call_type` | `"sip"` or `"webrtc"`. |
| `call_direction` | `"inbound"` or `"outbound"`. |
| `call_state` | `"active"`, `"ringing"`, `"hold"`, etc. |
| `node_id` | Random UUID. |
| `project_id` | Random UUID. |
| `space_id` | Random UUID. |
| `caller_id_name` | `"WebRTC User"` for webrtc; the from number for sip. |
| `caller_id_number` | The from number (`+15551234567` by default). |
| `call_start_time` | Current ISO 8601 timestamp. |
| `channel_type` | `"web"` for webrtc; `"phone"` for sip. |
| `from` | The from number. |
| `to` | The to extension. |
| `sip_headers` | Included only for sip calls; contains `X-SignalWire-Agent: swaig-test-cli`. |
| `vars` | Object with `call_type` and `direction`. |

### Minimal Mock Post Data

Used by `--exec`. Generated by `generateMinimalPostData()`.

Contains only the fields needed for function execution:

| Field | Description |
|---|---|
| `function` | Name of the SWAIG function being invoked. |
| `argument` | Arguments object passed to the function. |
| `call_id` | Random UUID (or overridden). |
| `call_type` | `"webrtc"`. |
| `call_direction` | `"inbound"`. |
| `caller_id_name` | `"CLI Test"`. |
| `caller_id_number` | `+15551234567`. |
| `from` | `+15551234567`. |
| `to` | `"test-agent"`. |

### MockCallOptions

The `MockCallOptions` interface defines the parameters accepted by the mock data generators:

| Property | Type | Default | Description |
|---|---|---|---|
| `callType` | `'sip' \| 'webrtc'` | `'webrtc'` | Call transport type. |
| `callDirection` | `'inbound' \| 'outbound'` | `'inbound'` | Direction of the call. |
| `callState` | `string` | `'active'` | Current call state. |
| `callId` | `string` | Random UUID | Override the auto-generated call ID. |
| `fromNumber` | `string` | `'+15551234567'` | Caller's phone number. |
| `toExtension` | `string` | `'test-agent'` | Destination extension or agent name. |
| `overrides` | `Record<string, unknown>` | -- | Additional key-value overrides merged into the post data. |

---

## Output Formatting

| Flag | Description |
|---|---|
| `--format-json` | Output results as pretty-printed (indented) JSON. |
| `--raw` | Raw JSON output. Suppresses all SDK log output by calling `suppressAllLogs(true)`. Useful for piping to `jq` or other tools. |
| `--verbose` | Enable verbose output. Sets the global log level to `debug`. |

When neither `--raw` nor `--format-json` is set, the CLI adds human-readable headers (e.g., `--- SWML Document ---`, `--- Result ---`) around the output.

When `--raw` or `--format-json` is set, only JSON is written to stdout, making it suitable for programmatic consumption.

---

## Route Override

Override the agent's HTTP route path:

```bash
npx tsx src/cli/swaig-test.ts my-agent.ts --dump-swml --route /custom-path
```

This sets `agent.route` to the specified path before generating SWML. Useful when testing agents that use different routes in production than what is hardcoded in their configuration.

---

## Environment Variables

### Inline (--env)

Set environment variables before the agent module is loaded. Repeatable.

```bash
npx tsx src/cli/swaig-test.ts my-agent.ts --dump-swml \
  --env SIGNALWIRE_LOG_LEVEL=debug \
  --env MY_API_KEY=abc123
```

Each `--env` takes a `KEY=VALUE` pair. The variable is set on `process.env` before the agent is loaded.

### From File (--env-file)

Load environment variables from a file:

```bash
npx tsx src/cli/swaig-test.ts my-agent.ts --dump-swml --env-file .env.test
```

The file format is standard `.env` syntax:

```
# Comments start with hash
SIGNALWIRE_LOG_LEVEL=info
MY_SECRET="quoted value"
ANOTHER_VAR='single quoted'
```

Processing rules:
- Blank lines and lines starting with `#` are skipped.
- Each line is split on the first `=` sign.
- Surrounding single or double quotes on values are stripped.
- Variables are set on `process.env`.

The `--env-file` is loaded before inline `--env` values, so inline values take precedence.

---

## Serverless Simulation

Simulate running your agent on a serverless platform:

```bash
npx tsx src/cli/swaig-test.ts my-agent.ts --simulate-serverless lambda
```

Supported platforms:

| Platform | Flag Value | Description |
|---|---|---|
| AWS Lambda | `lambda` | Simulates an API Gateway event. |
| Google Cloud Functions | `gcf` | Simulates a GCF HTTP request. |
| Azure Functions | `azure` | Simulates an Azure HTTP trigger. |
| CGI | `cgi` | Simulates CGI-style invocation. |

The simulation:
1. Creates a `ServerlessAdapter` for the specified platform.
2. Gets the Hono app from `agent.getApp()`.
3. Generates full mock POST data using the current call metadata options.
4. Constructs a simulated event with `POST` method, the agent's route, authorization headers, and the mock body.
5. Passes the event through the adapter's `handleRequest()`.
6. Prints the response status code, headers, and body.

This is useful for verifying that your agent works correctly when deployed to a serverless environment, without actually deploying.

---

## Examples

### Dump the SWML Document

Inspect the complete SWML configuration your agent generates:

```bash
npx tsx src/cli/swaig-test.ts ./src/my-agent.ts --dump-swml
```

Output (abridged):

```
--- SWML Document ---

{
  "version": "1.0.0",
  "sections": {
    "main": [
      { "answer": {} },
      {
        "ai": {
          "prompt": { ... },
          "SWAIG": { "functions": [ ... ] }
        }
      }
    ]
  }
}
```

### List Registered Tools

See what tools your agent exposes to the AI model:

```bash
npx tsx src/cli/swaig-test.ts ./src/my-agent.ts --list-tools
```

Output:

```
Registered tools (2):

  save_field
    Description: Save a collected field value from the caller.
    Parameters: {
      "type": "object",
      "properties": {
        "field_name": { "type": "string", ... },
        "value": { "type": "string", ... }
      },
      "required": ["field_name", "value"]
    }

  get_status
    Description: Get the current status of information gathering.
    Parameters: {
      "type": "object",
      "properties": {}
    }
```

### Execute a Tool

Run a tool handler directly and see the result:

```bash
npx tsx src/cli/swaig-test.ts ./src/my-agent.ts \
  --exec save_field \
  --arg field_name=email \
  --arg value=alice@example.com
```

Output:

```
Executing: save_field
Arguments: {"field_name":"email","value":"alice@example.com"}

--- Result ---

{
  "response": "Field \"email\" saved as \"alice@example.com\". Remaining required fields: phone."
}
```

### Test with Custom Caller Data

Simulate an inbound SIP call from a specific phone number:

```bash
npx tsx src/cli/swaig-test.ts ./src/my-agent.ts --dump-swml \
  --call-type sip \
  --from-number +15559876543 \
  --call-id my-test-call-001
```

### Simulate a SIP Call

Combine call metadata with tool execution to test how tools behave with SIP-specific data:

```bash
npx tsx src/cli/swaig-test.ts ./src/my-agent.ts \
  --exec search_faq \
  --arg query="business hours" \
  --call-type sip \
  --from-number +15559876543 \
  --override caller_id_name="John Doe"
```

### Test with Environment Variables

Pass secrets or configuration your agent needs:

```bash
npx tsx src/cli/swaig-test.ts ./src/my-agent.ts --dump-swml \
  --env SIGNALWIRE_LOG_LEVEL=debug \
  --env API_KEY=test-key-123

# Or from a file:
npx tsx src/cli/swaig-test.ts ./src/my-agent.ts --dump-swml \
  --env-file .env.test
```

### Machine-Readable Output

Pipe SWML or tool results to `jq` or other JSON processors:

```bash
# Suppress logs and get clean JSON
npx tsx src/cli/swaig-test.ts ./src/my-agent.ts --dump-swml --raw | jq '.sections.main'

# Pretty-printed JSON with no log noise
npx tsx src/cli/swaig-test.ts ./src/my-agent.ts --list-tools --format-json > tools.json
```

### Discover Agents in a File

When a module exports multiple agents, discover them and test a specific one:

```bash
# List all agents
npx tsx src/cli/swaig-test.ts ./src/multi-agent.ts --list-agents

# Output:
#   SalesAgent
#   SupportAgent
#   BillingAgent

# Test a specific agent
npx tsx src/cli/swaig-test.ts ./src/multi-agent.ts --dump-swml --agent-class SupportAgent
```

---

## Complete Option Reference

| Option | Argument | Default | Description |
|---|---|---|---|
| `--dump-swml` | -- | *(default action)* | Generate and output the SWML document. |
| `--list-tools` | -- | -- | List all registered SWAIG functions. |
| `--list-agents` | -- | -- | List all exported agents in the module. |
| `--exec` | `<function_name>` | -- | Execute a specific SWAIG function. |
| `--arg` | `key=value` | -- | Function argument (repeatable). |
| `--override` | `key=value` | -- | Override POST data field (repeatable). |
| `--agent-class` | `<export_name>` | -- | Use a specific named export. |
| `--route` | `<path>` | Agent's default | Override the agent's HTTP route. |
| `--call-type` | `sip \| webrtc` | `webrtc` | Call transport type. |
| `--call-direction` | `inbound \| outbound` | `inbound` | Call direction. |
| `--call-state` | `<state>` | `active` | Call state string. |
| `--call-id` | `<uuid>` | Random UUID | Override call ID. |
| `--from-number` | `<number>` | `+15551234567` | Caller's phone number. |
| `--to-extension` | `<ext>` | `test-agent` | Destination extension. |
| `--raw` | -- | -- | Raw JSON output, suppress logs. |
| `--verbose` | -- | -- | Enable debug-level logging. |
| `--format-json` | -- | -- | Pretty-print JSON output. |
| `--env` | `KEY=VALUE` | -- | Set environment variable (repeatable). |
| `--env-file` | `<path>` | -- | Load env vars from file. |
| `--simulate-serverless` | `lambda \| gcf \| azure \| cgi` | -- | Simulate serverless platform. |
| `--help`, `-h` | -- | -- | Show help message. |
