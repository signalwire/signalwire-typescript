# Examples

These TypeScript examples use the SignalWire AI Agents SDK. Run any of them with `npx tsx examples/<file>`.

## Quickstarts

These three files hold the code blocks of the repository README's quickstarts, which are included from them:

| File | Description |
|------|-------------|
| [quickstart-agent.ts](quickstart-agent.ts) | The README agent quickstart: an agent at `/agent` with a prompt section and a `get_time` tool |
| [quickstart-relay.ts](quickstart-relay.ts) | The README RELAY quickstart: answer an inbound call, play text-to-speech and hang up |
| [quickstart-rest.ts](quickstart-rest.ts) | The README REST quickstart: create an AI agent resource, play text-to-speech on a call and search phone numbers. Its credentials are placeholders, so it doesn't run as it is. |

## Agent Examples

| File | Description |
|------|-------------|
| [simple-agent.ts](simple-agent.ts) | Minimal agent with a prompt, hints, a language and a `get_time` tool |
| [typed-tools.ts](typed-tools.ts) | Tool handlers whose `args` type is inferred from `parameters`: an `enum` becomes a union, and `required` decides which keys are optional |
| [simple-static.ts](simple-static.ts) | Agent with a prompt and a voice, and no tools or dynamic config |
| [dynamic-config.ts](dynamic-config.ts) | Dynamic config callback that sets the language and the caller's name from the query string |
| [advanced-dynamic-config.ts](advanced-dynamic-config.ts) | Dynamic config callback with VIP detection from the caller's number, and department and language from the query string |
| [comprehensive-dynamic.ts](comprehensive-dynamic.ts) | Tier-based dynamic config with industry prompts, voice selection, LLM parameters and A/B testing |
| [declarative.ts](declarative.ts) | Agent subclass with `PROMPT_SECTIONS`, tools in `defineTools()`, and a post-prompt |
| [custom-path.ts](custom-path.ts) | Agent on a custom HTTP path, `/my-custom-agent`, with an optional proxy URL from `SWML_PROXY_URL_BASE` |
| [multi-agent.ts](multi-agent.ts) | Two agents on one `AgentServer`, at `/support` and `/sales` |
| [multi-endpoint.ts](multi-endpoint.ts) | Two agents on one `AgentServer`, at `/billing` and `/tech-support`, each with its own tool and voice |
| [pom-prompt.ts](pom-prompt.ts) | Prompt Object Model sections, bullets and subsections |

## Contexts, Steps, and Gather Info

| File | Description |
|------|-------------|
| [contexts-steps.ts](contexts-steps.ts) | A quiz as a multi-step workflow, with contexts, steps and per-step tools |
| [gather-info.ts](gather-info.ts) | A patient intake flow in three steps with completion criteria, ending with a `submit_intake` tool. It doesn't use `GatherInfo`, despite its header comment. |
| [gather-per-question-functions-demo.ts](gather-per-question-functions-demo.ts) | While a step's gather questions run, only `gather_submit` and the tools a question lists in `functions` are callable |
| [step-function-inheritance-demo.ts](step-function-inheritance-demo.ts) | A step without `setFunctions()` keeps the previous step's tools; four steps show inherit, replace and disable |

## DataMap (Server-Side Tools)

| File | Description |
|------|-------------|
| [datamap-tools.ts](datamap-tools.ts) | Two DataMap tools: a weather lookup built with `DataMap`, and a joke API built with `createSimpleApiTool()` |
| [advanced-datamap.ts](advanced-datamap.ts) | DataMap expressions, a `nomatch` output, error keys, `foreach`, and `${ENV.*}` expansion with a prefix allowlist |

## Skills

| File | Description |
|------|-------------|
| [skills-demo.ts](skills-demo.ts) | Built-in skills: datetime and math |
| [web-search.ts](web-search.ts) | Web search skill through the Google Custom Search API |
| [web-search-multi-instance.ts](web-search-multi-instance.ts) | Three web search instances (general, news, quick), with the Wikipedia, datetime and math skills |
| [wikipedia.ts](wikipedia.ts) | Wikipedia search skill, with no API key |
| [datasphere.ts](datasphere.ts) | DataSphere skill for knowledge base search |
| [datasphere-multi-instance.ts](datasphere-multi-instance.ts) | DataSphere skill loaded several times, one per document, with custom tool names |
| [datasphere-serverless-env.ts](datasphere-serverless-env.ts) | DataSphere serverless skill configured from environment variables |
| [datasphere-webhook-env.ts](datasphere-webhook-env.ts) | DataSphere webhook skill configured from environment variables |
| [mcp-agent.ts](mcp-agent.ts) | An MCP server endpoint (`/agent/mcp`) that exposes the agent's tools, and an MCP client that adds a remote server's tools |
| [mcp-gateway.ts](mcp-gateway.ts) | MCP gateway skill, which registers the tools of an MCP gateway's services |
| [joke-agent.ts](joke-agent.ts) | Joke skill (a built-in joke collection, no API key) with the datetime skill |

## SWAIG Features and FunctionResult Actions

| File | Description |
|------|-------------|
| [swaig-features.ts](swaig-features.ts) | FunctionResult actions: hangup, hold, say, background audio, global data, metadata, context switch, SMS and toggling functions |
| [record-call.ts](record-call.ts) | Start and stop call recording with FunctionResult actions |
| [room-and-sip.ts](room-and-sip.ts) | Room joining, SIP REFER and conferences |
| [tap.ts](tap.ts) | TAP action that streams call audio to an external endpoint |

## Call Flow and AI Configuration

| File | Description |
|------|-------------|
| [call-flow.ts](call-flow.ts) | Verbs before answer, after answer and after the AI, with call recording and a post-prompt |
| [llm-params.ts](llm-params.ts) | AI parameters (temperature, barge, timeouts), fillers, pronunciation and a post-prompt |
| [session-state.ts](session-state.ts) | Global data, a tool that updates it, and an `onSummary` handler for the post-prompt summary |
| [verb-methods.ts](verb-methods.ts) | Pre-answer, post-answer and post-AI verbs on an agent, and a standalone `SwmlBuilder` document |

## Prefab Agents

| File | Description |
|------|-------------|
| [prefab-info-gatherer.ts](prefab-info-gatherer.ts) | InfoGatherer prefab that asks a fixed list of questions, confirming some answers |
| [dynamic-info-gatherer.ts](dynamic-info-gatherer.ts) | InfoGatherer prefab that picks its question set from the query string |
| [prefab-survey.ts](prefab-survey.ts) | Survey prefab with rating, yes/no, multiple-choice and open questions, and branching |
| [prefab-concierge.ts](prefab-concierge.ts) | Concierge prefab for a venue's services, amenities and hours |
| [prefab-faq.ts](prefab-faq.ts) | FAQ bot prefab with keyword matching |
| [prefab-receptionist.ts](prefab-receptionist.ts) | Receptionist prefab that transfers callers to departments by phone number, with visitor check-in |

## SWML Service (Non-AI)

| File | Description |
|------|-------------|
| [swml-service.ts](swml-service.ts) | SWML service without an AI block: a greeting, a voicemail recording and a hangup |
| [dynamic-swml-service.ts](dynamic-swml-service.ts) | SWML service that builds a different document per request from the `action` query parameter |
| [swml-service-routing.ts](swml-service-routing.ts) | SWML service that routes to sales, support or a default IVR from the `dept` query parameter |
| [auto-vivified.ts](auto-vivified.ts) | Verb methods on `getBuilder()` and named sections, for voicemail, IVR and transfer services |
| [swmlservice_swaig_standalone.ts](swmlservice_swaig_standalone.ts) | `SWMLService` with no `AgentBase`, serving SWAIG functions on its own `/swaig` endpoint |
| [swmlservice_ai_sidecar.ts](swmlservice_ai_sidecar.ts) | `SWMLService` that emits the `ai_sidecar` verb and serves the tools the sidecar calls |

## Deployment

| File | Description |
|------|-------------|
| [kubernetes-agent.ts](kubernetes-agent.ts) | Agent with graceful shutdown, for the built-in `/health` and `/ready` endpoints |
| [serverless-lambda.ts](serverless-lambda.ts) | Agent on AWS Lambda through `ServerlessAdapter` |

## Client Examples

| File | Description |
|------|-------------|
| [relay-demo.ts](relay-demo.ts) | RELAY WebSocket client: answer calls and play text-to-speech |

## PGI Reference Implementation

The `pgi/` directory holds a support-intake agent whose steps each list their own tools, and whose handlers, not the model, move the call between steps:

| File | Description |
|------|-------------|
| [pgi/case-domain.ts](pgi/case-domain.ts) | The application's rules for support cases: input validation, proposal revisions and idempotent submission, with no SDK import |
| [pgi/support-agent.ts](pgi/support-agent.ts) | The agent built on those rules. It has no side effects; `serve.ts` builds and serves it. |
| [pgi/serve.ts](pgi/serve.ts) | Serves the agent. It refuses to start unless `CASE_TENANT_ID`, the basic auth variables, `SIGNALWIRE_SIGNING_KEY` and `SIGNALWIRE_SWAIG_SECRET` are set. |

## Test Harnesses

These files aren't usage examples. The porting-sdk audits run them against local test servers. They're in the repository but not in the npm package:

| File | Description |
|------|-------------|
| `relay_audit_harness.ts` | Drives a `RelayClient` through connect, subscribe and an event, for `audit_relay_handshake.py` |
| `rest_audit_harness.ts` | Runs one REST client operation against a test server, for `audit_rest_transport.py` |
| `skills_audit_harness.ts` | Runs one skill's handler against a test server, for `audit_skills_dispatch.py` |

## Running Examples

These commands run an example, with the credentials the skill and RELAY examples need:

```bash
# Run any example
npx tsx examples/simple-agent.ts

# Web search needs a Google Custom Search key and engine ID:
GOOGLE_SEARCH_API_KEY=your-key GOOGLE_SEARCH_ENGINE_ID=your-engine-id npx tsx examples/web-search.ts

# RELAY and DataSphere examples read the project credentials:
export SIGNALWIRE_PROJECT_ID=your-project-id
export SIGNALWIRE_API_TOKEN=your-api-token
export SIGNALWIRE_SPACE=your-space.signalwire.com
npx tsx examples/relay-demo.ts
```

## Environment Variables

The examples and the skills they load read these variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `SWML_BASIC_AUTH_USER` | Basic auth user name | `user` |
| `SWML_BASIC_AUTH_PASSWORD` | Basic auth password | `pass` |
| `SIGNALWIRE_PROJECT_ID` | Project ID (RELAY, REST, DataSphere) | None |
| `SIGNALWIRE_API_TOKEN` | API token (RELAY, REST, DataSphere) | None |
| `SIGNALWIRE_SPACE` | Space host name | None |
| `GOOGLE_SEARCH_API_KEY` | Google Custom Search key (web search) | None |
| `GOOGLE_SEARCH_ENGINE_ID` | Google search engine ID (web search); `GOOGLE_SEARCH_CX` also works | None |
| `DATASPHERE_DOCUMENT_ID` | DataSphere document ID (the `-env` DataSphere examples) | None |
| `SW_NEWS_API_KEY` | NewsAPI key, expanded into the `get_news` URL in `advanced-datamap.ts` | None |

## Conventions these examples follow

These examples are meant to be copied, so they model the SDK's typed, idiomatic
patterns. When you add or edit an example, follow the same rules. The LINT and FMT
gates enforce the mechanical ones, and review covers the rest:

- **Tools: let the schema type the handler.** Write `parameters` as an inline
  flat map and list `required`; `defineTool<P,R>` infers `args` precisely
  (`args.phone: string`, an `enum` prop narrows to its literal union, `required`
  keys are present and the rest optional). Do **not** annotate the handler param
  (`handler: (args: Record<string, unknown>) => ...`), which opts out of inference,
  and do **not** cast or bracket-read args (`args['x'] as string`). Use
  `args.x` directly. See [typed-tools.ts](typed-tools.ts).
- **Use the typed callback bodies, don't widen them.** The SDK types
  `setDynamicConfigCallback`'s body as `SwmlRequestData`, `onSummary`'s `rawData`
  as `PostPromptData`, and SWAIG handler `rawData` as `SwaigRequestData`. Read
  fields directly (`bodyParams.call?.from`, `rawData.params.call_id`). Never
  re-type one of these params looser in an override (e.g.
  `onSummary(_, rawData: Record<string, unknown>)`). That drops the contract and
  hides bugs. (Import the contract types from the package root.)
- **No `any`, no file-level `eslint-disable`.** Open/dynamic values are `unknown`
  + narrowing; a justified one-off is a line-level `// eslint-disable-next-line`
  with a reason. (Genuinely dynamic tree-walking by string key uses
  `Record<string, unknown>` + indexing, which is correct.)
- **Drop dead casts the types made unnecessary.** If a value's static type
  already has the field, read it directly, with no `as` and no `['key']`.
- **Generic error wrappers.** A `safe(label, fn)` helper must be generic
  (`safe<T>(label, fn: () => Promise<T>): Promise<T | null>`) so results keep
  their type at the call site.
