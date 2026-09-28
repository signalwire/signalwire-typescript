# swaig-test CLI Guide

`swaig-test` loads an agent file and lets you inspect its SWML, list its SWAIG functions, and call one, without a phone call or a deployment.

---

## Table of Contents

The guide has these sections:

- [Overview](#overview)
- [Running It](#running-it)
- [Finding the Agent](#finding-the-agent)
- [Actions](#actions)
  - [--dump-swml](#--dump-swml)
  - [--list-tools](#--list-tools)
  - [--exec](#--exec)
  - [--list-agents](#--list-agents)
- [Function Arguments](#function-arguments)
- [The Simulated Request](#the-simulated-request)
- [Dynamic Agents](#dynamic-agents)
- [DataMap Functions](#datamap-functions)
- [Environment Variables](#environment-variables)
- [Serverless Simulation](#serverless-simulation)
- [Output](#output)
- [Option Reference](#option-reference)

---

## Overview

`swaig-test` sends its requests through the agent's own HTTP app, as SignalWire would:

- The SWML is requested with a simulated call. Basic auth, signature checks, a dynamic config callback and the tokens in the webhook URLs all run as they do on a server.
- A function is called at the `web_hook_url` its SWML gives it, with that URL's token and query. A function that points at another server is called there.
- A DataMap function runs in a local simulator of the platform's DataMap processing.

The CLI's code is in these source files:

- `src/cli/swaig-test.ts`: the command and its options.
- `src/cli/agent-loader.ts`: finding the agent in a file.
- `src/cli/simulation.ts`: the simulated request data and serverless environments.
- `src/cli/function-args.ts`: function arguments.
- `src/cli/datamap-exec.ts`: the DataMap simulator.

---

## Running It

Run the CLI with `npx tsx` during development:

```bash
npx tsx src/cli/swaig-test.ts <agent-file> [options]
```

A built package runs the compiled file:

```bash
node dist/cli/swaig-test.js <agent-file> [options]
```

The agent file is a `.ts`, `.js`, `.mjs` or `.mts` file. These print the help, the serverless options and a set of examples:

```bash
npx tsx src/cli/swaig-test.ts --help
npx tsx src/cli/swaig-test.ts --help-platforms
npx tsx src/cli/swaig-test.ts --help-examples
```

`--parse-only` (or `--dry-run`) checks the arguments and exits without loading the agent. It prints `parse OK` on success:

```bash
npx tsx src/cli/swaig-test.ts examples/simple-agent.ts --exec get_time --parse-only
```

---

## Finding the Agent

The file is imported with `SWAIG_CLI_MODE=true`, so `serve()` and `run()` return without starting a server. The loader then takes, in order:

| Order | What it takes |
|---|---|
| 1 | With `--agent-class NAME`, that export: an instance, or a class it instantiates. |
| 2 | With `--route ROUTE`, the service with that route, exported or not. |
| 3 | The `agent` export, then the default export, then any exported agent instance. |
| 4 | An exported agent class, instantiated with `{ name: 'cli-agent' }`. |
| 5 | An exported `SWMLService`. |
| 6 | A service the file constructed without exporting it. |

The last case covers a file like the quickstart, which builds `const agent = new AgentBase(...)` and calls `agent.run()`. When a file constructs several services without exporting them, such as agents registered on an `AgentServer`, choose one with `--route`:

```bash
npx tsx src/cli/swaig-test.ts examples/multi-agent.ts --list-agents
npx tsx src/cli/swaig-test.ts examples/multi-agent.ts --route /support --list-tools
```

`--route` and `--agent-class` can't be used together.

---

## Actions

Each run takes one action. Without one, the CLI exits with an error, except with `--simulate-serverless`, where it prints the SWML.

### --dump-swml

This prints the SWML document the agent serves for a simulated call:

```bash
npx tsx src/cli/swaig-test.ts examples/simple-agent.ts --dump-swml
```

The output is the JSON document alone, indented. `--raw` prints it on one line. SDK logging is off unless `--verbose` is given, so the output can be piped:

```bash
npx tsx src/cli/swaig-test.ts examples/simple-agent.ts --dump-swml --raw | jq '.sections.main'
```

### --list-tools

This lists the functions in the agent's SWML, with their parameters. A function's type follows its name. `(LOCAL webhook)` marks a handler in the agent, and `(EXTERNAL webhook)` one on another server. A DataMap function has no marker.

```bash
npx tsx src/cli/swaig-test.ts examples/datamap-tools.ts --list-tools
```

The output lists both of the file's DataMap functions:

```text
Available SWAIG functions:
  get_weather - Get current weather for a city
    Parameters:
      city (string) (required): The city name
  get_joke - Execute get_joke
    Parameters: None
```

`get_joke` has no description of its own, so the SDK's default, `Execute <name>`, appears.

With `--raw` or `--format-json` the list is JSON, one object per function with `name`, `description`, `parameters` and `type` (`local`, `external` or `datamap`).

### --exec

This calls one function and prints its result. Everything after the function name is an argument for the function. See [Function Arguments](#function-arguments).

```bash
npx tsx src/cli/swaig-test.ts examples/simple-agent.ts --exec get_time
```

The output starts with `RESULT:`, then the response and any actions:

```text
RESULT:
Response: The current date and time is 9/28/2026, 5:53:03 PM
```

`--raw` or `--format-json` prints the SWAIG response as JSON instead. The exit status is 1 when the function isn't found, an argument doesn't fit, or the call fails.

### --list-agents

This lists the agents and services in the file, exported or not:

```bash
npx tsx src/cli/swaig-test.ts examples/multi-agent.ts --list-agents
```

For each instance it prints its name and route.

---

## Function Arguments

Put the CLI's own options before `--exec`. After the function name, each `--name value` is an argument, typed by the function's parameter schema:

| Parameter type | Value |
|---|---|
| `integer` | Parsed as an integer; anything else is an error. |
| `number` | Parsed as a number; anything else is an error. |
| `boolean` | `true` or `false` after it, or nothing (the flag alone is `true`). |
| `array` | Split on commas. |
| other | The string. |

A dash in a name becomes an underscore, so `--max-results 5` sets `max_results`. `--arg name=value` also sets an argument, parsing the value as JSON when it can.

These commands call `book_appointment` in `examples/typed-tools.ts`, whose `party_size` parameter is an integer:

```bash
npx tsx src/cli/swaig-test.ts examples/typed-tools.ts --exec book_appointment --service haircut --party-size 2 --notes "window seat"
npx tsx src/cli/swaig-test.ts examples/typed-tools.ts --exec book_appointment --arg service=massage --arg party_size=3
```

The first command prints this result:

```text
RESULT:
Response: Booked a haircut for 2 (window seat). See you soon!
```

A value that doesn't fit its type stops the run. `--party-size two` prints `Error parsing arguments: Parameter --party-size must be an integer, got: two`.

An argument the function doesn't declare is still passed, with a warning on stderr. For `--foo bar`, the warning is `Warning: --foo isn't a parameter of this function; it was passed to the function anyway.`

When an undeclared argument has the name of a CLI option, such as `--raw`, the warning says to put it before `--exec`. When that option ends the line with no value after it, as in `--exec get_time --verbose`, the CLI stops instead. It prints `Error parsing arguments: CLI flag --verbose must come BEFORE --exec, not after.` and exits with status 1. A function can declare a parameter with an option's name. `check_status` in `examples/typed-tools.ts` has a `verbose` parameter, so `--exec check_status --verbose` sets it.

---

## The Simulated Request

`--dump-swml` and `--list-tools` send the SWML request SignalWire sends: a `call` object with the call's id, type, direction, state and addresses, `vars.userVariables`, and `envs`. `--exec` requests the SWML the same way, then calls the function. Its request has every key SignalWire may send (`call`, `vars`, `global_data`, `call_log`, `meta_data` and the rest). `--minimal` sends only the call id and the arguments.

These options set values in the request, for every action:

| Option | Sets |
|---|---|
| `--call-type sip\|webrtc` | The call type and matching addresses (default `webrtc`). |
| `--call-direction inbound\|outbound` | `call.direction` (default `inbound`). |
| `--call-state STATE` | `call.state` (default `created`). |
| `--call-id ID` | `call_id` and `call.call_id`. |
| `--project-id ID`, `--space-id ID` | `call.project_id`, `call.space_id`. |
| `--from-number NUMBER`, `--to-extension EXT` | `call.from`, `call.to`. |
| `--user-vars JSON` | `vars.userVariables`. |
| `--custom-data JSON` | Values merged into the function request. |

`--override PATH=VALUE` sets any value by its dotted path, and `--override-json PATH=JSON` sets one to parsed JSON. A value of `true`, `false`, `null` or a number is typed. Anything else is a string, or JSON when it parses. This command marks the call answered and sets a user variable:

```bash
npx tsx src/cli/swaig-test.ts examples/simple-agent.ts --override call.state=answered --override-json 'vars.userVariables={"vip":true}' --dump-swml
```

An override whose path isn't in the simulated request, such as a misspelled `call.stat`, still applies, with a warning on stderr.

---

## Dynamic Agents

An agent with a dynamic config callback gets the request's query parameters, headers and body, as on a server. These options set them:

| Option | Sets |
|---|---|
| `--query-params JSON` | The SWML request's query parameters (also merged into `vars.userVariables`). |
| `--header NAME=VALUE` | A request header (repeatable). |
| `--body JSON` | Extra fields in the SWML request body. |
| `--method POST\|GET` | The SWML request's method (default `POST`). |

The callback runs once per request, on a per-request copy of the agent, so it runs once for `--dump-swml`. A function call is a separate request: as on the platform, it carries only the query in its `web_hook_url`. A callback that needs a value from the SWML request when a function runs puts it there with `addSwaigQueryParams()`. The callback in `examples/dynamic-config.ts` reads `lang` and `name` from the query. This command sends both, and prints the prompt, languages and global data the callback set:

```bash
npx tsx src/cli/swaig-test.ts examples/dynamic-config.ts --query-params '{"lang":"es","name":"Carlos"}' --dump-swml --raw | jq -c '.sections.main[] | select(.ai) | {prompt: .ai.prompt.text, lang: .ai.languages, gd: .ai.global_data}'
```

The output shows the Spanish voice and the caller's name:

```json
{"prompt":"You are a helpful assistant. The caller's name is Carlos. Greet them by name.","lang":[{"name":"Spanish","code":"es-ES","voice":"polly.Lucia"}],"gd":{"caller_name":"Carlos"}}
```

---

## DataMap Functions

`--exec` runs a DataMap function in a local simulator that follows the platform's processing. It tries the expressions, then the webhooks in order until one succeeds. It then runs that webhook's `foreach` and `output`, or the DataMap's own `output` when every webhook failed.

The simulator follows the platform's template rules:

- A webhook's JSON object response is read from the root of the template data (`${current.temp_f}`). A JSON array response is under `array` (`${array[0].joke}`). When a template reads `${response.<field>}`, which doesn't resolve, the simulator says so on stderr.
- Templates take the `lc` and `enc` (or `enc:url`) helpers, left to right, and nest: `${lc:enc:args.city}`.
- A webhook fails on a status outside 200-299, a body that isn't JSON, or one of its `error_keys` in a JSON object response.
- Webhook requests refuse private and internal addresses, as the SDK's other URL fetches do. Set `SWML_ALLOW_PRIVATE_URLS=true` to test against a server on your own machine.

This command runs the weather tool against the real wttr.in API and prints each step:

```bash
npx tsx src/cli/swaig-test.ts examples/datamap-tools.ts --verbose --exec get_weather --city London
```

With `--verbose`, the output ends with the DataMap steps: the request, the response status and the result.

```text
=== DataMap Function Execution ===
Args: {"city":"London"}

=== Webhook 1/1 ===
GET https://wttr.in/london?format=j1
Response status: 200
RESULT:
Response: Weather in London: 61°F, Overcast
```

A path that doesn't resolve shows as `<MISSING:path>` in the result. The simulator's other differences from the platform are listed in [Testing a DataMap](datamap-guide.md#testing-a-datamap).

---

## Environment Variables

`--env KEY=VALUE` sets a variable before the agent file loads. `--env-file FILE` loads `KEY=VALUE` lines from a file, skipping `#` lines and removing quotes around a value. This command sets the basic auth user and loads the rest from `.env` in the current directory:

```bash
npx tsx src/cli/swaig-test.ts examples/simple-agent.ts --env SWML_BASIC_AUTH_USER=admin --env-file .env --dump-swml
```

Node.js 24 also reads `--env-file` itself, wherever it appears on the command line. When the file doesn't exist, Node stops before `swaig-test` runs, printing `node: .env: not found` with exit status 9.

---

## Serverless Simulation

`--simulate-serverless PLATFORM` loads and runs the agent with a serverless platform's environment, so its webhook URLs are the platform's. The platforms are `lambda`, `cgi`, `gcf` (or `cloud_function`) and `azure` (or `azure_function`). `SWML_PROXY_URL_BASE` is cleared for the run.

```bash
npx tsx src/cli/swaig-test.ts examples/simple-agent.ts --simulate-serverless lambda --dump-swml
npx tsx src/cli/swaig-test.ts examples/simple-agent.ts --simulate-serverless lambda --aws-api-gateway-id abc123 --aws-stage prod --exec get_time
npx tsx src/cli/swaig-test.ts examples/simple-agent.ts --simulate-serverless cgi --cgi-host example.com --cgi-https --dump-swml
```

Each platform's options set its variables:

| Platform | Options |
|---|---|
| `lambda` | `--aws-function-name`, `--aws-function-url`, `--aws-region`, `--aws-api-gateway-id` and `--aws-stage` (an API Gateway URL, `https://ID.execute-api.REGION.amazonaws.com/STAGE`) |
| `cgi` | `--cgi-host` (required), `--cgi-script-name`, `--cgi-https`, `--cgi-path-info` |
| `gcf` | `--gcp-project`, `--gcp-function-url`, `--gcp-region`, `--gcp-service` |
| `azure` | `--azure-env`, `--azure-function-url` |

An unknown platform is an error, and the CLI exits with status 2. It never falls back to running as a server.

---

## Output

| Option | Effect |
|---|---|
| `--raw` | JSON only, with SDK logging off. |
| `--format-json` | JSON results, indented. |
| `-v`, `--verbose` | Each step, the requests sent, and debug logging. |

Warnings go to stderr, so they don't mix with JSON on stdout.

---

## Option Reference

| Option | Description |
|---|---|
| `--list-agents` | List the agents and services in the file. |
| `--list-tools` | List the SWAIG functions. |
| `--dump-swml` | Print the SWML document. |
| `--exec FUNCTION [args]` | Call a function; the rest of the line is its arguments. |
| `--agent-class NAME` | Use this export. |
| `--route ROUTE` | Use the service with this route. |
| `--raw`, `--format-json`, `-v`/`--verbose` | Output. |
| `--minimal`, `--fake-full-data`, `--custom-data JSON` | The function request. |
| `--call-type`, `--call-direction`, `--call-state`, `--call-id`, `--project-id`, `--space-id`, `--from-number`, `--to-extension`, `--user-vars` | Call data. |
| `--override PATH=VALUE`, `--override-json PATH=JSON` | Set values in the request (repeatable). |
| `--query-params JSON`, `--header NAME=VALUE`, `--body JSON`, `--method` | The SWML request. |
| `--env KEY=VALUE`, `--env-file FILE` | Environment variables. |
| `--simulate-serverless PLATFORM` and the platform options | Serverless simulation. |
| `--parse-only`, `--dry-run` | Check the arguments only. |
| `--help`, `--help-platforms`, `--help-examples` | Help. |
