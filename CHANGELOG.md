# Changelog

All notable changes to `@signalwire/sdk` are documented here. This project
follows [Semantic Versioning](https://semver.org/).

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
