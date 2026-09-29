# Changelog

All notable changes to `@signalwire/sdk` are documented here. This project
follows [Semantic Versioning](https://semver.org/).

## Unreleased (Wave 1)

The Wave 1 breaking work. Adopts the reference SDK's per-request transport
envelope across the whole REST surface and ships the cross-port parity/hardening
legs. This will land as part of the coordinated Wave-1 MAJOR at the release cut —
per WAVE_4.0_PLAN D5, version numbers are NOT set during the wave, so this stays
`Unreleased` (the `package.json` version is unchanged) until the fleet cuts 4.0.

### Added

- `sw-tsdocs`: the SDK's documentation for the installed version, for people
  and coding agents. With no arguments it prints an index; `sw-tsdocs <topic>`
  covers an area, with the installed docs to read, examples and API names;
  `sw-tsdocs api <name>` prints a signature, JSDoc, source location and members
  from the package's declarations; `examples`, `grep`, `show` and `path` find
  the installed files; and `sw-tsdocs init` adds a section to a project's
  `AGENTS.md` that tells coding agents to use it. `swaig-test --help` points
  to it, and the package's `dist/llms.txt` and `dist/AGENTS.md` list the docs.
- The package ships its docs and examples: `docs/`, `examples/` (without the
  audit harnesses), the RELAY, REST and LiveWire READMEs, docs and examples,
  and `CHANGELOG.md`, in their repository layout. The examples import
  `'@signalwire/sdk'`, so a copy runs as it is. The tarball grows from about
  1.0 MB to 1.7 MB.
- `AgentBase` option `swaigSecret` (or `SIGNALWIRE_SWAIG_SECRET`): the
  secret that signs SWAIG function tokens, so a token minted by one replica,
  or before a restart, still validates. Without it each process generates
  its own.
- `AgentBase.addPerCallConfig(cb)`: per-request configuration callbacks that
  accumulate and run in order on the same copy, so separate pieces of code
  can each configure what they own. `setDynamicConfigCallback` replaces the
  whole chain.
- `AgentBase.onCallEnd(handler)`: run handlers with the transcript when the
  call ends. It registers the platform's reserved `hangup_hook` function and
  turns on `swaig_post_conversation`, without which the hook carries no
  transcript.
- `AgentBase.mount(appOrRouter, { prefix })`: serve another Hono app or a
  fetch handler alongside the agent's routes. The mount survives the agent
  rebuilding its app, answers its own CORS preflights and sets its own
  headers, and isn't behind the agent's basic auth.
- `FunctionResult` can separate what a tool did from what the model should
  say: `setToolResponse(toolResult, toolPrompt)` (or the constructor's third
  and fourth arguments) sends `response` as
  `{ tool_result, tool_prompt }`, so a status line isn't read aloud and an
  instruction isn't taken for data. The plain string form is unchanged.
- `FunctionResult.hold(prompt, timeout, step, timeoutStep)`: a prompt is
  delivered before the hold lands (it sets the structured response and
  `postProcess`), and `step`/`timeoutStep` move the call to a step when it's
  taken off hold or the hold times out. `hold()` and `hold(120)` are
  unchanged.
- `FunctionResult.rpcAiMessage()` takes `globalData`, merged into the other
  call's global data, and its message text is optional;
  `rpcAiGlobalData(callId, data)` sends data only.
- `userVariables`, `declaredCapabilities` and `hasCapability` read the
  capabilities a browser client declares in its user variables, such as
  `display_content`. A capability counts only when declared truthy; a missing
  or malformed declaration means not declared. They're hints about what the
  client can render, not permissions, since the caller sets them.
- `normalizePostPrompt(body)` returns one `NormalizedPostPrompt` for a
  post-prompt from either the voice or the chat engine: the medium, the
  conversation and call IDs, the parsed summary, and the user and assistant
  turns with tool calls and the chat engine's summary echo removed.
  `parsePostPromptData`, `dialogueTurns` and `stripJsonFence` are exported for
  the individual steps. None of them throws on malformed input.
- `ChatGateway`: lets a browser chat widget use the AI Chat service
  through your app without holding an API token. The widget presents a
  publishable key; the gateway checks it and the page's origin, keeps the
  conversation id in a signed handle, sends its own `config_url`, and caps
  new conversations per window and turns per conversation. `router()` is a
  Hono app for `agent.mount(gateway.router(), { prefix: '/chat' })`; a chat
  reply is streamed through, keepalive padding included. `start` opens a
  conversation so the agent speaks first, and `log` returns only the user
  and assistant turns. The browser's `user_meta_data` is forwarded, limited
  to 8 KiB. `SIGNALWIRE_CHAT_GATEWAY_KEY` and
  `SIGNALWIRE_CHAT_GATEWAY_SECRET` supply the key and handle secret.
- `HandoffRouter`: the `/handoff`, `/escalate` and `/say` routes the
  SignalWire address widget calls beside a gateway, to move a conversation
  between a call and chat and to type into a live call. The browser proves
  which call it's on with a single-use nonce the application registers from
  the dial. The next medium starts after the application's callback
  captures the previous leg, or after `captureTimeout` if the capture fails
  or takes too long. Typing is capped per call; a `sendMessage` that
  throws or returns `false` doesn't count. The routes answer their own
  CORS preflights for origins the gateway allows.
- `AIChatClient.rawPost(method, params)` returns the response with its body
  unread, for a proxy that streams it through.
- `AIChatClient` reads a service URL from `RAILS_DEV_MODE` (a boolean value
  is ignored), accepts a space hostname (`example.signalwire.com`) in
  `space`/`SIGNALWIRE_SPACE` as the REST client does (#186), sends the SDK's
  User-Agent, and warns when a conversation id holds characters the service
  will strip.
- `swaig-test` sends its requests through the agent's own HTTP app, as
  SignalWire would: the SWML is fetched with a simulated call (so basic
  auth, signatures, the dynamic config callback and webhook tokens run as on
  a server, and the callback runs once for `--dump-swml`), and `--exec`
  calls a function at the `web_hook_url` its SWML gives it. It gains the
  Python SDK's options:
  - Function arguments after `--exec <function>` as `--name value`, typed by
    the function's schema, with a warning for an argument the function
    doesn't declare (`--arg name=value` still works).
  - A DataMap simulator, so `--exec` runs a DataMap function; external
    webhook functions are called at their URL.
  - `--query-params`, `--header`, `--body`, `--method`, `--user-vars`,
    `--custom-data`, `--minimal`, `--fake-full-data`, `--override-json`,
    `--project-id`, `--space-id`, `--help-platforms` and `--help-examples`.
  - Serverless simulation that runs any action with the platform's
    environment, with `--aws-*`, `--cgi-*`, `--gcp-*` and `--azure-*`
    options (`--aws-api-gateway-id` and `--aws-stage` give an API Gateway
    URL), and the Python platform names `cloud_function` and
    `azure_function`.
  - `--list-tools` lists DataMap and external functions with their
    parameters.
  - It finds an agent the file constructs without exporting (the
    quickstart's), and `--route` picks a service in a file with several.
  - The simulated call is the same when `--exec` finds the function and
    when it calls it, so `--override`, `--override-json` and the call flags
    reach a dynamic config callback both times. A plain `SWMLService`'s
    function is called through its `/swaig` route.
  - Requests are signed over `SWML_PROXY_URL_BASE` when it's set, as the
    platform signs them. Credentials in an external webhook URL are sent as
    basic auth.
  - `--exec` exits `1` when every webhook of a DataMap function fails and
    it has no fallback output. A webhook's timeout covers its body.
  - A simulated platform's environment replaces other platforms' variables
    the shell had set, and they're restored afterwards.
- **`requestOptions` on every REST resource verb** — each `list` / `paginate` /
  `get` / `create` / `update` / `delete` / `list_addresses` and every generated
  operation / command-dispatch / set-method now accepts a trailing optional
  `requestOptions?: RequestOptionsInit` (timeout / retries / backoff /
  `abortSignal`), threaded to the transport and forwarded to every page fetch by
  `paginate()`. Mirrors the Python reference's keyword-only `request_options`.
- Custom-CA env vars for outbound TLS documented: `SIGNALWIRE_REST_CA_FILE`
  (REST) and `SIGNALWIRE_RELAY_CA_FILE` (RELAY) — opt-in trust-adding, never
  disables verification.

### Changed (breaking)

- Generated REST resource verb signatures gained the trailing `requestOptions`
  parameter (inserted before the `**kwargs`/`**params` variadic tail). Existing
  call sites keep working — the parameter is optional and the variadic tail is
  preserved — but the declared signatures changed, hence the MAJOR bump.
- `mcp_gateway` TLS verification is a two-key opt-in: disabling it now requires
  BOTH `verify_ssl=false` AND `allow_insecure_tls=true`; the secure default
  (verification ON) is preserved and a lone `verify_ssl=false` is ignored.

### Security

- With a dynamic config callback set, only SWML rendering used the
  callback's per-request copy of the agent; SWAIG function calls and summary
  deliveries ran on the agent itself. A tool the callback made `secure` ran
  the agent's own unsecured tool with no token, and a tool the callback
  registered was advertised in the SWML but answered `404`. A function call
  and a summary now run on a copy the callback configured from that request,
  so the tool that runs, and whose token is checked, is the one the SWML
  advertised.
- The agent's `/mcp` endpoint (`enableMcpServer()`) had no authentication, so
  anyone who could reach the server could run the agent's tools, secure ones
  included. It now requires the agent's basic auth credentials, and lists and
  calls only the tools the agent runs itself, not external webhook tools. An
  MCP client must now send an `Authorization` header.
- A secure SWAIG function ran when the request carried no token at all;
  only a wrong token was refused. Now a secure function runs only with a valid
  token for that function and call, and a request with no token or no
  `call_id` is refused like a wrong one.
- Tokens for a call whose id contains a dot (composed conversation ids such as
  `root.2`) never validated, so that call's secure functions were refused.
- `GET /?call_id=<id>` now mints the SWML's function tokens for that call. It
  used to ignore the query and mint them for a random session.
- A `POST` to the post-prompt endpoint delivered a summary to `onSummary`
  with no token; the token minted into the post-prompt URL was never checked.
  It now needs that token for the call (`403` otherwise), and a request whose
  URL and body name different calls gets `400`, so one call's token can't
  deliver another call's summary.
- A `GET` to the post-prompt endpoint called `onSummary` with an empty
  summary. It now returns the SWML document, like the agent's root.
- Routing-callback paths (`registerRoutingCallback`) render SWML like the
  root, but a `POST` to one skipped the webhook signature check. With a
  signing key set, it now needs a valid signature like the root; a `GET`
  stays unsigned.
- The spider and web_search skills checked a URL before fetching it, then
  followed redirects, so a public page that redirected to an internal
  address, such as a cloud metadata service, was fetched and returned. A
  hostname whose DNS answer changed between the check and the connection had
  the same effect. They now check every request, redirects included (up to
  10), and refuse a connection to a private or internal address. A redirect
  to another origin drops the `Authorization` and `Cookie` headers.
- `isPrivateIp()`, `validateUrl()` and `resolveAndValidateUrl()` let through
  every IPv6 literal written in URL brackets (`http://[::1]/`), IPv4-mapped
  addresses such as `::ffff:169.254.169.254`, the unspecified address `::`,
  and `0.0.0.0/8`. They now block all of them. `validateUrl()` also refuses
  a URL that isn't http or https, and a hostname that doesn't resolve (it
  used to allow a DNS failure), and checks every address a hostname resolves
  to, not only the first.
- The per-request copy of an agent that a dynamic config callback configures
  shared many fields with the agent itself, so what one call's callback
  changed reached every later call. A query param added with
  `addSwaigQueryParams()` (a tenant id, say) appeared in the next caller's
  webhook URLs; `addMcpServer()`, `addFunctionInclude()` and
  `addInternalFiller()` accumulated on the agent; `setPromptLlmParams()`
  changed the agent's own settings; and `resetContexts()` cleared the agent's
  contexts. The copy now has its own copies of all of these, and of the SIP
  usernames, routing callbacks, verbs, params and global data. Plain data,
  arrays, Maps, Sets, Dates and contexts are copied; other objects in them
  (a `URL`, a `RegExp`, a class instance) are shared with the agent, so
  don't mutate one of those in place from a callback.
- Webhook signature validation accepts the stronger
  `X-SignalWire-Sha256-Signature` header (hex HMAC-SHA256 of the URL and raw
  body), preferred over the SHA-1 `X-SignalWire-Signature` when present, and
  falls back to the SHA-1 header so existing deployments keep working. New
  exports: `validateWebhookSignatureSha256()` and
  `SIGNALWIRE_SHA256_SIGNATURE_HEADER`.
- `redactUrl()` left the password in a URL with an empty user
  (`http://:secret@host`), and masked only the first URL in a string. It now
  masks both.
- native_vector_search: a `remote_url` with only a user or only a password
  kept its credentials in the URL, so the request failed and the error, which
  quoted the whole URL, was logged at ERROR. Either one is now sent as basic
  auth and removed from the URL. ERROR logs record only an error's type; its
  message, which can echo the caller's query, a remote error or a URL, is
  logged at DEBUG with URLs redacted.
- Serverless signature checks now use the URL SignalWire signed: the URL the
  platform was called on, with its query, and the raw body. They used the URL
  the adapter built for routing, so with a signing key set, signed requests
  got `403` behind an API Gateway stage, a CGI script path or an Azure
  function app, on Google Cloud Functions (the query was dropped and the
  parsed body re-serialized), and on API Gateway REST (its `Host` header was
  missed). API Gateway REST events, which lose the query's original encoding,
  are checked with both the `+` and `%20` forms. Behind a trusted forwarded
  host, the platform's path prefix is kept.
- Azure Functions requests, whose URL is absolute, are routed by the path
  below `/api/<function>`; they got `404`.
- `run()` and `runServerless()` in CGI mode read the request body from stdin
  and write the CGI response to stdout. They read no body and wrote nothing.
- A per-request copy shared the agent's tool objects, so a dynamic config
  callback that changed a tool (turning `secure` off for one tenant, say)
  changed it for every later call. The copy now has its own tools.
- A Google Cloud Function on `cloudfunctions.net` refused SignalWire's
  signed requests with `403`: the signature was checked over the request's
  URL, without the function name the webhook URL carries. It's checked over
  the webhook URL first.
- `SWML_RATE_LIMIT` counted every client in one bucket unless
  `SWML_TRUST_PROXY_HEADERS` was set, so one client over the limit got every
  other client refused, SignalWire included. Each client is keyed by its
  connection address.
- Overriding `validateBasicAuth()` on an agent had no effect: the routes
  compared credentials themselves, and not in constant time. Every
  protected route now checks through `validateBasicAuth()`, whose default
  compares in constant time.
- `WebService` served files through symbolic links that pointed outside a
  mounted directory. It resolves the real path and refuses anything outside
  the mount.
- `HandoffRouter.register()` reset a nonce when it was registered again, so
  re-sending a call's SWML request reset the `/say` message cap, revived a
  nonce `/handoff` had redeemed, and could move a live nonce to another
  call. The first registration now stands, and a redeemed nonce stays used.
- The mcp_gateway skill and native_vector_search in remote mode checked
  their URL only at setup; every request, redirects included, is now
  checked for private and internal addresses.
- `SkillRegistry.unregister()` and `clear()` removed locked skills, so a
  built-in could be removed and replaced by another class. Locked names
  stay.

### Fixed

- Agents: `AgentBase.serve()` and `AgentServer.run()` serve HTTPS from
  `SWML_SSL_ENABLED`, `SWML_SSL_CERT_PATH` and `SWML_SSL_KEY_PATH`, as the
  Python SDK does; they served plain HTTP. `SWML_SSL_ENABLED` accepts
  `true`, `1` or `yes`, and `stop()` closes the server `serve()` started.
- `run()` on Cloud Run, which sets `K_SERVICE` but not `FUNCTION_TARGET`,
  handled one empty request instead of starting the server.
- `*` in `SWML_ALLOWED_HOSTS` refused every host, and in
  `SWML_CORS_ORIGINS` allowed no origin; it now allows all, as in Python.
- `schemaValidation: false` and `schemaPath` now apply to the verbs an
  agent renders; only `SWML_SKIP_SCHEMA_VALIDATION` worked.
- `addLanguage()` emitted fillers as objects the schema doesn't define.
  `LanguageConfig` gains `speechFillers`, and fillers are emitted as string
  arrays, as the Python SDK emits them; the object forms are flattened with
  a warning.
- `defineContexts()` given a plain object ignored it; it renders it as the
  contexts and returns the agent, as the Python SDK does with a dict.
- Tool arguments that don't match the tool's schema log a warning before
  the handler runs, as in the Python SDK; `validateArgs()` was never called.
- A skill's `swaig_fields: { secure: false }` now lets its tools run
  without a per-call token; it only changed the rendered definition.
- `getRegisteredTools()` returned an empty description and no parameters
  for DataMap tools.
- `suppressLogs: true` didn't silence the warnings the constructor logged
  first.
- `SWMLService` routing callbacks: an async callback was redirected to
  `[object Promise]`, and a throwing one failed the request. The route
  awaits the callback and otherwise serves the request's SWML.
- `AgentServer.setupSipRouting()` and `registerGlobalRoutingCallback()`
  called after `register()` served the callback at a doubled path
  (`/sales/sales/sip`) or not at all.
- `SWMLService.serve()` warns when the service serves without basic auth
  because its credentials were generated (the Python SDK enforces them;
  see PORT_BEHAVIORAL_NOTES.md).
- DataMap: a webhook's output reads the tool's arguments as
  `${input.args.x}`; `${args.x}` expands to nothing there on the platform.
  The datasphere_serverless skill's result and the DataMap examples read
  them that way now.
- swaig-test's DataMap simulator follows the platform: the template data
  each stage reads, `nomatch-output`, webhook `expressions`, foreach with
  the webhook's data, `params` as the body whenever set, the first webhook
  requested deciding the result, `error_keys` failing by presence,
  case-insensitive patterns, and headers sent as written.
- swaig-test: `--help` shows `--call-direction inbound|outbound` and
  lists `--project-id` and `--space-id`; the Lambda and Cloud Functions
  simulations honor the function name, region and project options; the
  Azure simulation names the function.
- RELAY: a sent message with an `on()` listener stayed tracked after it
  finished; `DialOptions` and `SendMessageOptions` are the types `dial()`
  and `sendMessage()` take; the `stream()` track values are the protocol's.
- LiveWire: `runApp()` serves the agent of the session its entry function
  starts (it served nothing, so the quick start and examples started no
  server); an LLM plugin object sets the model (it rendered
  `[object Object]`); `tools` may be an object keyed by name, as LiveKit
  agents-js takes it.
- Bedrock: `BedrockAgent` warns when a render leaves hints, languages,
  pronunciation, multilingual or debug settings out of the verb, and when
  `setPromptLlmParams()` gets a non-number.
- `WebService` takes credentials from `SWML_BASIC_AUTH_USER` and
  `SWML_BASIC_AUTH_PASSWORD` and the config file; `addDirectory()` and
  `removeDirectory()` work on a running service, and a `/` mount serves; an
  invalid `web_service.json` is skipped with a warning.
- Prefabs: `InfoGathererAgent` passes the request's query parameters and
  headers to its callback (it passed `{}`); `SurveyAgent` and
  `ReceptionistAgent` drop a call's state when its summary arrives, after
  an hour idle, or beyond 10,000 calls.
- Skills: importing the SDK no longer fails without optional packages
  (mcp_gateway imported undici, which isn't a dependency); weather_api
  loads with `api_key` alone and defaults to Fahrenheit, as its schema says;
  google_maps and ask_claude read their `api_key` parameter;
  `agent.skillManager.loadSkill()` registers the skill on the agent;
  discovery scans `addSkillDirectory()` directories and finds compiled
  `skill.js`; custom_skills honors a parameter's `required`; schema
  defaults and descriptions match the code.
- Examples: `llm-params.ts`, `advanced-datamap.ts`, `gather-info.ts`,
  `mcp-gateway.ts`, the DataSphere examples and `serverless-lambda.ts` did
  what their headers said only in part, or threw on load; they're fixed.
- `defineContexts()` called with no argument replaced the agent's contexts
  with a new, empty builder. It returns the existing builder, creating one
  on first use, as the Python SDK's `define_contexts()` does; pass a
  `ContextBuilder` to replace the workflow.
- RELAY `Call.userEvent()` sent only `event` and dropped the other fields
  its options accept. It sends them all, as the Python SDK does.
- RELAY `sendMessage()` sent an empty `context` when the client had no
  relay protocol yet, instead of `'default'`.
- The RELAY outbound and messaging examples passed milliseconds to
  `wait()`, which takes seconds.
- Contexts and steps rendered as `ai.contexts`, beside the prompt. The
  platform reads them inside the prompt, as `ai.prompt.contexts`, which is
  where the Python SDK renders them; they now render there.
- `swaig-test --exec` ignored `--call-state`, and an `--override` key
  nothing read was accepted silently (#188). The call data flags now apply
  to every action, `--override` takes a dotted path (`call.state=answered`),
  and an override whose path isn't in the simulated request gets a warning.
- The `DataMap` class's doc example passed `true` as `parameter()`'s fourth
  argument, which drops `required`; it takes `{ required: true }`.
- On a serverless platform, the SWML's webhook URLs pointed at
  `http://localhost:3000` unless `SWML_PROXY_URL_BASE` was set. They now use
  the URL the platform serves the function on, as the Python SDK does: a
  Lambda function URL (`AWS_LAMBDA_FUNCTION_URL`), the CGI script's URL, a
  Google Cloud Function's URL (`FUNCTION_URL`, or built from the project,
  region and service), or an Azure Function's (`AZURE_FUNCTION_URL`, or
  built from `WEBSITE_SITE_NAME` and `AZURE_FUNCTION_NAME`). Behind Azure
  and Google Cloud Functions handlers, the URL the request arrived on is
  used. `SWML_PROXY_URL_BASE` still takes precedence. An agent running its
  own server with `serve()` keeps its host and port, and a Google Cloud
  Function is recognized by `FUNCTION_TARGET` (or `FUNCTION_URL`), so a
  server on Cloud Run, which sets `K_SERVICE`, isn't taken for one.
- Schema validation of `amazon_bedrock`, `cond`, `connect`, `execute`,
  `ai_sidecar`, `join_conference` and `switch` checked only their required
  properties: their schemas refer back to the document schema, the
  per-verb validator couldn't compile, and validation silently fell back.
  They're now fully validated, like the other verbs and as the Python SDK
  validates them. A failed choice among allowed values names them
  (`voice_id must be one of: tiffany, matthew, ...`).
- The joke skill's result now tells the model to tell the joke
  (`Tell this joke to the user: ...`). Given only the joke, the model
  answered it instead of relaying it. The tool description is `Get a joke
  to tell the caller`.
- `native_vector_search`: `keyword_weight` is described as what it does
  here, in-memory ranking only, and setting it with `remote_url` logs a
  warning, since the server ranks remote results. `model_name` is
  described as having no effect in this SDK. (The Python SDK deprecated
  `keyword_weight` because its engine ignores it; this SDK's in-memory
  ranking uses it.)
- The spider skill advertised settings it didn't honor. `follow_robots_txt`
  was never checked: with it on, `scrape_url`, `extract_structured_data`
  and `crawl_site` now skip pages the site's robots.txt disallows for
  `user_agent`, check each redirect's target too, and keep a site's rules
  for 24 hours (a robots.txt that fails with a server or network error is
  tried again on the next request). The schema's defaults now match the
  skill's (`max_text_length` 3000, `follow_robots_txt` false,
  `user_agent` `Spider/1.0 (SignalWire AI Agent)`), and `extract_type`
  lists `fast_text`, `markdown` and `structured`. The never-implemented
  `clean_text`, `full_text`, `html` and `custom` still run as `fast_text`,
  with a warning; any other value fails setup. `concurrent_requests` is
  deprecated and has no effect.
- `BedrockAgent` rendered its `amazon_bedrock` prompt without
  `max_tokens`, which the constructor and `setInferenceParams()` stored, and
  dropped `presence_penalty` and `frequency_penalty`, which the Bedrock
  prompt defines. `setPromptLlmParams()` now works: `temperature`, `top_p`
  and `max_tokens` update the inference settings, and `confidence` and the
  two penalties go into the prompt; any other setting, such as
  `barge_confidence`, is ignored with a warning. The documented example
  voice is one Bedrock offers (`tiffany`, `matthew`, `amy`, `lupe` or
  `carlos`).
- `AIChatClient`'s read timeout (`readIdleTimeoutSeconds`, default 60) was
  a limit on the whole request, so a slow reply the service kept alive with
  keepalive padding was cut off at 60 seconds. It's now an idle timeout that
  every chunk restarts.
- `FunctionResult.executeSwml(swml, true)` put `transfer` inside the SWML
  document, where it isn't a SWML key, so the call never left the agent. It
  now goes beside the document, as `connect()` sends it.
- `FunctionResult.tap()` accepted `direction: 'hear'`, which the engine
  rejects, and left the direction out for the default `both`, so the verb's
  own default (`speak`) tapped less than asked. Directions are now
  `speak`/`listen`/`both` (`TAP_DIRECTIONS` too), and the direction is
  always sent.
- The prefab agents' tool handlers (FAQ bot, info gatherer, receptionist,
  survey, concierge) run on the agent running the call, so a dynamic config
  callback that changes their data (a tenant's FAQs, say) takes effect in
  the tools too. They were bound to the agent itself.
- `onSwmlRequest(requestData, callbackPath, context)` receives the Hono
  context on a served request, as documented; it was always undefined.
- A plain `SWMLService`'s `/swaig` answered `{}` for an `async` tool
  handler, since it didn't await the result. It now awaits it, and returns a
  `FunctionResult` or string result as a SWAIG response.
- `AgentServer` served an agent under its route twice (`/sales/sales`),
  so `register(agent)` answered `404` at the agent's own route.
  `asRouter()` now returns the agent's routes relative to its root, like the
  reference's `as_router()`, and `AgentServer` mounts it under the route;
  `getApp()` still serves them under the agent's route.
- An agent's app and `AgentServer` serve a path with a trailing slash or
  repeated slashes (`/agent/swaig/`, `/agent//swaig`) like the plain path,
  with the same auth and signature checks; they answered `404`. `asRouter()`
  registers `/swaig/`, `/post_prompt/` and routing-callback paths with a
  trailing slash too, for a host app with strict routing.
- `AgentServer.getApp()` threw ("Can not add a route since the matcher is
  already built") when called again after the server had handled a request.
- Constructor arguments take precedence over an agent's config file, as
  documented. The file's `service.name` always replaced the `name` passed to
  `AgentBase`, and its route and host replaced a `route: '/'` or
  `host: '0.0.0.0'` passed on purpose; now the file fills in only what the
  caller left out.
- `AgentBase` ignored basic auth credentials in its config file. Credentials
  now resolve as: constructor, config file, environment, generated.
  `getBasicAuthCredentials(true)` reports `'config file'` for the file's
  (`SWMLService` reported them as `'environment'`), and the file's
  `security.auth.basic` key is read as well as `security.basicAuth`. A
  password set without a user (in the file or `SWML_BASIC_AUTH_PASSWORD`)
  gets the user `signalwire`.
- A tool handler gets the agent running the call as a third argument,
  `(args, rawData, agent)`: with a dynamic config callback, the request's
  configured copy, so the handler sees what the callback set up. `onSummary`
  runs on that copy too. Existing two-argument handlers are unaffected.
- A `fetch_conversation` request to the post-prompt endpoint now gets back
  what `onSummary` returns, as the platform expects; the endpoint answered
  `{ ok: true }` either way. Other deliveries now answer `{ success: true }`,
  as the reference does.
- `GET /swaig` (with `?call_id=` for a call's tokens) returns the SWML
  document, like the agent's root; it answered `400`.
- The per-request copy of an agent loaded every skill again, running each
  skill's `setup()` on every request, and its skill list was empty while
  that finished. It now starts with the skills the agent loaded, without
  setting them up again. Removing one from the copy leaves the agent's
  instance alone.
- With a dynamic config callback, an agent's structured (POM) prompt was
  rendered to text on the per-request copy, and a section the callback added
  with `promptAddSection()` was lost. The copy now keeps the POM sections, so
  the prompt stays structured and includes the callback's sections.
- `LOG_LEVEL` is case-insensitive and an unknown value falls back to `info`
  (never `debug`).
- `paginate()` guards against a repeating server cursor (no infinite loop).
- SWAIG `/swaig` handlers receive the unwrapped `argument.parsed` flat args.

### Notes for upgraders

- An agent's `validateBasicAuth()` override now replaces the credential
  check on every route. An override written to add a check and return
  `true` must call `super.validateBasicAuth()` to keep the comparison.
- `SWML_SSL_ENABLED` with a certificate and key makes an agent serve HTTPS.
  An agent behind a TLS-terminating proxy with those variables set should
  unset them.
- `LanguageConfig`'s object forms of `fillers` and `functionFillers` still
  work, flattened into lists with a warning; pass `speechFillers` and
  `functionFillers` as string arrays.
- In a DataMap webhook's output, read the tool's arguments as
  `${input.args.x}`; `${args.x}` there always expanded to nothing on the
  platform.
- `swaig-test`: everything after `--exec <function>` is now an argument
  for the function, so put the CLI's own options (`--raw`, `--verbose`)
  before `--exec`. `--route` now picks the service with that route instead
  of changing the agent's route. `--call-state` defaults to `created`. The
  output of `--dump-swml` is the JSON document alone, and `--exec` prints
  `RESULT:` and the response. `--simulate-serverless` runs the chosen
  action with the platform's environment instead of printing a simulated
  platform response.
- A `FunctionResult`'s structured response (`setToolResponse()`, or the
  constructor's third and fourth arguments) is sent by `toDict()`; the
  `response` property stays the plain string. `setResponse()` clears the
  structured form; assigning `response` directly doesn't.
- Adding an `execute`, `connect`, `cond`, `switch`, `join_conference`,
  `ai_sidecar` or `amazon_bedrock` verb with an unknown or mistyped key
  now fails schema validation, where it used to pass. The first of these
  verbs validated in a process compiles the document schema, which takes
  up to about a second; `SWML_SKIP_SCHEMA_VALIDATION=true` turns
  validation off.
- `FunctionResult.tap({ direction: 'hear' })` now throws; use `'listen'`.
- `rpcAiMessage()` throws when given neither message text nor global data.
- `asRouter()` returns routes relative to the agent's root. Mount it under
  the agent's route: `hostApp.route(agent.route, agent.asRouter())`. Code
  that mounted it at `/` to get the routes under the agent's route should use
  `getApp()`, or mount it at the route.
- A subclass that passes its own default (say `route: '/'`) to `AgentBase`
  now overrides a route set in the config file even when its caller didn't
  pass one. Forward only the options the caller gave.
- Basic auth credentials in a config file now win over
  `SWML_BASIC_AUTH_USER`/`SWML_BASIC_AUTH_PASSWORD`.
- With a dynamic config callback set, a function call runs on the
  request's configured copy of the agent, and so does `onSummary`. A handler
  gets the copy as its third argument; a handler that captured the agent (an
  arrow function, or a method passed with `.bind(this)`) still sees the agent
  itself, so read per-call configuration from the third argument. The SDK's
  prefabs do. State `onSummary` keeps by assigning to the agent
  (`this.count += 1`) now lands on the copy and is gone after the request;
  keep it in an object the agent already holds, or in your own storage.
- An agent subclass with JavaScript `#private` fields can't be copied per
  request (a copy doesn't carry them), so with a dynamic config callback its
  methods that read them throw on the copy. Use TypeScript `private` fields.
- An exception from `onSummary` is logged, and the post-prompt endpoint
  answers `{ success: true }`, as the reference does; it used to answer 500.
- The post-prompt endpoint answers a delivered summary with
  `{ success: true }` instead of `{ ok: true }`.
- A secure SWAIG function called directly, for example with `curl`, now
  needs the token from its `web_hook_url` in the SWML, fetched with
  `GET /?call_id=<id>`. SignalWire's own requests already carry it, and
  `swaig-test` is unaffected.
- A `POST` to the post-prompt endpoint needs the token from the SWML's
  `post_prompt_url`; SignalWire's requests already carry it.
- An MCP client that calls an agent's `/mcp` endpoint must send the agent's
  basic auth credentials.
- The spider and web_search skills fetch pages directly, ignoring any
  environment proxy. To fetch through a proxy that blocks private
  destinations itself, set `SWML_URL_FETCH_USE_PROXY` and turn on Node's proxy
  support (`NODE_USE_ENV_PROXY=1`) with `HTTP_PROXY`/`HTTPS_PROXY`; a request
  that `NO_PROXY` exempts still connects directly, with the address check.
- `validateUrl()` refuses a hostname that doesn't resolve. Code that relied on
  it passing unresolvable hosts, such as tests that stub `fetch`, can set
  `SWML_ALLOW_PRIVATE_URLS` while testing.

## 3.2.0

Adds the **Messages** REST resource (send + redact).

### Added

- `client.messages` — `Messages` resource bound to `/api/messaging/messages`
  (`BaseResource`) with `create` (POST — send an SMS/MMS) and `update` (PATCH
  `/{message_id}` — redact a message body). Generated from
  `porting-sdk/rest-apis/messages` via the spec-discovery REST generator.
  Distinct from the message **logs** namespace (`client.logs.messages`, read-only
  `/api/messaging/logs`).

### Fixed

- REST generator: a spec field literally named `body` (the Messages create/redact
  bodies) no longer collides with the assembled request-body local variable — the
  local falls back to `body_` when a `body` parameter is emitted.

## 3.1.0

Adds the plural **Projects** REST resource.

### Added

- `client.projects` — full-CRUD `Projects` resource bound to `/api/projects`
  (list, get, create, update, delete) plus `rotateSigningKey` (POST
  `/{id}/signing-key/rotate`). Generated from `porting-sdk/rest-apis/projects`
  via the spec-discovery REST generator. Distinct from the singular
  `project` token namespace (`/api/project/tokens`).

## 3.0.2

Release-readiness milestone for the TypeScript SDK.

### Added

- `exports` map in `package.json` exposing the public entry point and the
  `@signalwire/sdk/livewire` subpath (previously importable only from the source
  tree), plus `package.json` self-export for tooling.
- Package metadata: `keywords`, `bugs`, and `author` fields.
- `port_signatures.baseline.json` — the committed public-API surface floor that
  the SEMVER-DIFF gate diffs the working tree against.
- This CHANGELOG.

### Notes

- No public API signatures were removed or retyped; the surface is unchanged
  from the recorded baseline.
