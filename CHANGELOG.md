# Changelog

All notable changes to `@signalwire/sdk` are documented here. This project
follows [Semantic Versioning](https://semver.org/).

## 4.0.0

The Wave 1 breaking release. Adopts the reference SDK's per-request transport
envelope across the whole REST surface and ships the cross-port parity/hardening
legs. MAJOR because the generated REST resource verbs' signatures changed.

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

### Fixed

- `LOG_LEVEL` is case-insensitive and an unknown value falls back to `info`
  (never `debug`).
- `paginate()` guards against a repeating server cursor (no infinite loop).
- SWAIG `/swaig` handlers receive the unwrapped `argument.parsed` flat args.

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
