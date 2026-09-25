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
  usernames, routing callbacks, verbs, params and global data.

### Fixed

- `LOG_LEVEL` is case-insensitive and an unknown value falls back to `info`
  (never `debug`).
- `paginate()` guards against a repeating server cursor (no infinite loop).
- SWAIG `/swaig` handlers receive the unwrapped `argument.parsed` flat args.

### Notes for upgraders

- A secure SWAIG function called directly, for example with `curl`, now
  needs the token from its `web_hook_url` in the SWML, fetched with
  `GET /?call_id=<id>`. SignalWire's own requests already carry it, and
  `swaig-test` is unaffected.
- A `POST` to the post-prompt endpoint needs the token from the SWML's
  `post_prompt_url`; SignalWire's requests already carry it.
- An MCP client that calls an agent's `/mcp` endpoint must send the agent's
  basic auth credentials.
- The spider and web_search skills fetch pages directly, ignoring any
  environment proxy. Set `SWML_URL_FETCH_USE_PROXY` to fetch through a proxy
  that blocks private destinations itself.
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
