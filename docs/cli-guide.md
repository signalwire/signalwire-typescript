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
- [sw-tsdocs: The SDK's Installed Documentation](#sw-tsdocs-the-sdks-installed-documentation)
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

The agent file is a `.ts`, `.js`, `.mjs` or `.mts` file. Without a TypeScript loader, Node runs a `.ts` file by stripping its types, and it doesn't map an import of `./handlers.js` to `./handlers.ts`, so an agent split across several `.ts` files fails with `ERR_MODULE_NOT_FOUND`. Install `tsx` in the project and load it into the installed command:

<!-- snippet: no-run needs an installed package, tsx and a multi-file agent -->
```bash
npm install -D tsx
NODE_OPTIONS='--import tsx' npx swaig-test penny.ts --list-tools
```

These print the help, the serverless options and a set of examples:

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
| `--custom-data JSON` | Values merged into the function request. A DataMap function reads them as the call data the platform adds, such as `global_data`; without `global_data`, it reads the agent's global data. |

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

`--exec` runs a DataMap function in a local simulator that follows the platform's processing. It tries the top-level expressions, then the webhooks in order, skipping one when none of its `require_args` is set or it has neither `output` nor `expressions`. The first webhook it requests ends the webhook stage: it runs that webhook's `foreach`, its `expressions` against the response, and its `output`. The DataMap's own `output` is the result when that webhook failed, when none was requested, or when its expressions didn't match and it has no `output`. When nothing produces a result, the result is the platform's generic error, `{"response": "There was an error processing this request."}`, and `swaig-test` says so on stderr. It exits with status 0, since that is a valid result on the platform, not a failure of the tool.

The simulator follows the platform's template rules:

- The top-level expressions and output, and a webhook's `url` and `params`, read the call data: the function's name, `meta_data`, the arguments under `args` (`${args.city}`), and an empty `input`. The top-level output also has `prompt_vars`. `--custom-data` gives the call data the platform adds, at its root: `--custom-data '{"global_data": {"tenant": "acme"}}'` makes `${global_data.tenant}` read `acme`. Without `global_data` in `--custom-data`, `global_data` is the agent's global data, as a call starts with it. The `prompt_vars` in `--custom-data` are merged into the root too, so `{"prompt_vars": {"time_of_day": "morning"}}` gives `${time_of_day}`.
- `meta_data` is the function's `meta_data` merged key by key over `global_data`, as the platform merges them when it loads the function, so `${meta_data.tenant}` reads a `global_data` key the function's `meta_data` doesn't set. A `meta_data` key in `--custom-data` isn't used.
- A webhook's `foreach`, `expressions` and `output` read its response. A JSON object response is read from the root (`${current.temp_f}`), and a JSON array response is under `array` (`${array[0].joke}`). `prompt_vars`, `global_data` and `input`, a copy of the call data, are added, so the arguments are `${input.args.city}` there.
- Names match without regard to case, as on the platform: `${ARGS.City}` reads `args.city`. A path that doesn't resolve expands to an empty string, as on the platform, and the simulator says so on stderr. The note adds a hint for a common mistake: `${response.<field>}`, `${args.<name>}` in a webhook's `foreach`, `expressions` or `output`, and `${input.<name>}` before a webhook responds.
- Templates take the platform's `lc`, `enc` and `fmt_ph` helpers. As on the platform, they apply in a fixed order, `fmt_ph`, then `lc`, then `enc`, whatever order they are written in, so `${lc:enc:args.city}` and `${enc:lc:args.city}` both lowercase the city, then URL-encode it. `enc` encodes the characters the platform encodes, so `/`, `,` and `$` stay as they are. `fmt_ph` formats a number as the platform does, with libphonenumber, when the optional `libphonenumber-js` package is installed (`npm install -D libphonenumber-js`): a valid number in its national format, reading one without a country code as a US number, so `+12025550143` is `(202) 555-0143` and `+442079460958` is `020 7946 0958`, and `INVALID NUMBER` for one that isn't valid. Without the package, the simulator formats only a North American number, and leaves another value as it is, saying so on stderr.
- Any other name before a colon is part of the path, as on the platform: `${enc:url:args.city}` reads the path `url:args.city`, which doesn't resolve. The simulator's note suggests `${enc:args.city}`.
- A template nested in a path expands first, one level deep: `${meta_data.contacts.${lc:args.dept}}`. A template expands once, so a value that holds text such as `${global_data.x}` is inserted as it is. The exception is a matched webhook expression's result, which the platform expands a second time.
- A value that isn't a string is inserted as the platform prints it: `72.5` as `72.500000`, and an object as JSON over several lines. An output is expanded as JSON text and parsed, as on the platform, so a template that inserts an object or array inside a string breaks the output. The simulator then returns an `error` that says so, and `swaig-test` prints it and exits with status 0.
- A webhook fails on an empty body, a body that isn't JSON, a request that doesn't complete, or one of its `error_keys` present in a JSON object response, whatever the value. A status outside 200-299 doesn't fail it; the output reads it as `${http_code}`. A request that doesn't complete gives `http_code` as curl reports it on the platform: the last status received, a redirect's included, or `0` when no response came back. An `error_keys` on the `data_map` itself is ignored, as on the platform.
- `params`, with the arguments merged in when `input_args_as_params` is set, is the request body, and a request with `params` is a `POST` whatever its method, and any other request is a `GET`. With `form_param`, the body is one form field holding the JSON. Header values are sent as written. Credentials in the `url`, as in `https://user:pass@host/`, are sent as basic authentication.
- `expressions` and `webhooks` can each be a single object instead of a list, as on the platform. A single expression runs as a one-element list. A single webhook's `require_args` and `error_keys` aren't checked, and a failed request doesn't fail it: its output reads the error response, such as `${parse_error}` and `${http_code}`.
- Redirects are followed as the platform's curl follows them: from any 3xx response with a `Location`, up to 15, and a `POST` is sent again, with its body, after any of them. Credentials go only to the origin they were given for. Every request, redirects included, refuses private and internal addresses, as the SDK's other URL fetches do. Set `SWML_ALLOW_PRIVATE_URLS=true` to test against a server on your own machine.

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

The simulator's differences from the platform are listed in [Testing a DataMap](datamap-guide.md#testing-a-datamap).

---

## Environment Variables

`--env KEY=VALUE` sets a variable before the agent file loads. `--env-file FILE` loads `KEY=VALUE` lines from a file, skipping `#` lines and removing quotes around a value. This command sets the basic auth user and loads the rest from `.env` in the current directory:

```bash
npx tsx src/cli/swaig-test.ts examples/simple-agent.ts --env SWML_BASIC_AUTH_USER=admin --env-file .env --dump-swml
```

Node.js checks every `--env-file` on its command line itself, even one after the script name. Node 22 and 24 both do, so it happens however you run the CLI: the installed `swaig-test`, `node dist/cli/swaig-test.js` and `npx tsx src/cli/swaig-test.ts` alike. When the file exists, Node doesn't load it and passes the option on, and `swaig-test` loads the file. When the file doesn't exist, Node stops before `swaig-test` runs, printing `node: .env: not found` with exit status 9. Check the path, or set the variables with `--env`.

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

Each platform starts from a preset environment with a sample function URL. When you give a part of the URL without the URL itself, the preset URL is dropped and the URL is built from the parts. A part can come from a flag, `--env` or `--env-file`. For Lambda, `--aws-function-name` or `--aws-region` (`AWS_LAMBDA_FUNCTION_NAME`, `AWS_REGION`) without `--aws-function-url` (`AWS_LAMBDA_FUNCTION_URL`) gives `https://NAME.lambda-url.REGION.on.aws`, with `test-agent-function` and `us-east-1` for the part you leave out. So `--env AWS_REGION=eu-west-1` gives a URL in `eu-west-1`. In the same way, `--gcp-project`, `--gcp-region` or `--gcp-service` without `--gcp-function-url` gives `https://REGION-PROJECT.cloudfunctions.net/SERVICE`. The Azure preset's URL is `https://my-function-app.azurewebsites.net/api/agent`; `--azure-function-url` replaces it.

The SDK reads some parts under two names, and prefers one: `GOOGLE_CLOUD_PROJECT` over `GCP_PROJECT`, `FUNCTION_REGION` over `GOOGLE_CLOUD_REGION`, `K_SERVICE` over `FUNCTION_TARGET`, and `WEBSITE_SITE_NAME` over `AZURE_FUNCTIONS_APP_NAME`. A part you give under the other name wins over the preset's value under the preferred one. So `--env GCP_PROJECT=production` gives a URL in the `production` project, and `--env AZURE_FUNCTIONS_APP_NAME=prod-app` one on `prod-app.azurewebsites.net`.

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

## sw-tsdocs: The SDK's Installed Documentation

`sw-tsdocs` prints the SDK's documentation for the installed version. It's written for people and for coding agents: the output is Markdown, with full paths to the docs and examples installed with the package. Run it with `npx` in a project that depends on `@signalwire/sdk` (`node dist/cli/tsdocs/bin.js` in a built clone):

```bash
npx sw-tsdocs                          # the index: what the SDK does, where to start, every topic
npx sw-tsdocs agents                   # one topic: concepts, files to read, examples, API names
npx sw-tsdocs skills web_search        # a built-in skill's parameters
npx sw-tsdocs api AgentBase            # a signature, JSDoc and members, from the installed declarations
npx sw-tsdocs api FunctionResult.connect
npx sw-tsdocs examples contexts        # the examples for a topic, or those matching a word
npx sw-tsdocs grep "setFunctions"      # search the docs and examples; --code adds the SDK's code
npx sw-tsdocs show agent-guide --toc   # a doc's headings; --section <heading> prints one section
npx sw-tsdocs path                     # where the package and its docs are installed
npx sw-tsdocs init                     # add a note about sw-tsdocs to this project's AGENTS.md
```

The topics are short and hand-written: they describe concepts and known mistakes, and point to the installed docs for the rest. The facts come from the installed package: the version, the commands, the built-in skills and their parameters, the prefabs, the REST namespaces, the environment variables the code reads, and every signature and JSDoc comment. `api` reads an index of the package's `.d.ts` files that the build writes, so it works without the TypeScript source.

`sw-tsdocs init` adds a section to the project's `AGENTS.md` telling coding agents to use `sw-tsdocs`, and to `CLAUDE.md` if the project has one that doesn't import `AGENTS.md`. Run it again to update the section. `--skill` also writes an Agent Skills `SKILL.md` under `.agents/skills/` and `.claude/skills/`, `--dir` names the project, and `--print` prints the section without writing anything.

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
