# PORT_BEHAVIORAL_NOTES.md

Behavioral divergences between the TypeScript port and the Python reference
that the audit gates **cannot** see, and the verdict reached for each.

## Why this file exists

The cross-port gates police the *surface* (public signatures via DRIFT, the
exported symbol set via SURFACE, generated wire types via GEN-FRESH) and one
slice of *emission* (`FunctionResult.to_dict()` via EMISSION). They do **not**
cover a skill's SWAIG **tool contract** — the `parameters` / `required` / `enum`
each skill puts on the wire from `getTools()`, nor a skill's config-validation
behavior, nor which backend a handler calls. Two ports can pass every gate and
still hand the model different tools.

This file is the human-readable ledger for those behavioral findings: each row
is verified against source on both sides (file:line cited), with a verdict of
**FIXED**, **KEEP** (TS is correct / intentional), **UPSTREAM** (the Python
reference looks wrong; fix it there, not by downgrading TS), or **OPEN** (needs
a dedicated pass). It is not machine-parsed — it is the record so nothing stays
silent.

`required` note: Python's `SWAIGFunction` omits the `required` key entirely when
the list is empty (`core/swaig_function.py:128`). So "Python passes no
`required` arg" == "no `required` key on the wire" — a TS port that emits
`required: [...]` there is adding a key the reference never sends.

---

## Findings

### datasphere — FIXED
- TS emitted `required: ['query']`; Python passes no `required`
  (`datasphere/skill.py:171`).
- Verdict: **FIXED** — dropped `required` to match the reference's emission.
  `args.query` is now optional, narrowed by the existing runtime guard.

### api_ninjas_trivia — FIXED
- TS omitted `required`; Python's DataMap tool marks it
  `required: ['category']` (`api_ninjas_trivia/skill.py:179`).
- Verdict: **FIXED** — added `required: ['category']` to match. The handler
  still defaults a missing value to `default_category`.

### math — FIXED (earlier in this PR)
- TS emitted `required: ['expression']`; Python passes no `required`
  (`math/skill.py:33`).
- Verdict: **FIXED** — dropped `required` to match the reference's emission.

### play_background_file — FIXED (earlier in this PR)
- TS grew a free-form fallback (`play_background` / `stop_background` +
  arbitrary `file_url`, plus `default_file_url` / `allowed_domains` config)
  when no `files` were configured. Python REQUIRES `files`
  (`play_background_file/skill.py:106` raises) and only ever emits one
  `action`-enum DataMap tool.
- Verdict: **FIXED** — `setup()` now fails on empty `files`; the free-form tools
  and config were removed; the single `action`-enum tool remains.
- Residual (OPEN): Python builds this tool as a server-side **DataMap**
  (`data_map` expressions); TS uses a client-side **handler**. Same observable
  tool shape, different execution model. See "DataMap vs handler" below.

### mcp_gateway — KEEP (Python reference looks buggy → UPSTREAM)
- The dynamic MCP tool: TS passes the MCP `inputSchema.required` list through to
  the SWAIG schema (`mcp_gateway.ts:532`). Python builds the identical params
  but never reads `required` from the input schema, so it drops it
  (`mcp_gateway/skill.py:269-274`, no `required=` arg).
- Python honors `required` in *every other* skill that has it (spider
  `skill.py:246`, datasphere_serverless `:185`, joke `:71`, swml_transfer
  `:186/195`) — so the MCP omission is almost certainly an oversight, not a
  design choice.
- Verdict: **KEEP** TS (it is the correct behavior — a model should know which
  MCP args are required). **UPSTREAM**: file a fix for signalwire-python to wire
  the MCP schema's `required` through. TS is intentionally ahead of the
  reference here.

### joke — OPEN (substantial divergence; documented, not yet reconciled)
- TS: a single tool named `tell_joke` with a `category` param (enum
  `general / programming / dad`), served from a **local, offline joke library**
  (`joke.ts:27,83,110`).
- Python: a DataMap tool named `get_joke` with a `type` param (enum
  `jokes / dadjokes`), served from the **API-Ninjas** webhook
  (`joke/skill.py:64-80`).
- Different tool name, different param name + enum values, different data source
  (offline vs networked). A model trained against one will not drive the other.
- Verdict: **OPEN** — deliberately documented rather than rewritten. Reconciling
  means choosing offline-library vs API-Ninjas parity; deferred to a focused
  pass.

### google_maps — OPEN (name collision with divergent semantics + extra tools)
- `compute_route` is the same tool *name* on both sides but a **different
  contract**: Python takes 4 coordinate floats `origin_lat/lng`,
  `dest_lat/lng`, no `required` (`google_maps/skill.py:457-481`); TS takes
  string `origin`/`destination` + `mode` with `required: ['origin',
  'destination']` (`google_maps.ts:191-208`). A model calling `compute_route`
  with Python's coord args fails on TS, and vice versa.
- TS additionally registers two tools Python lacks: `geocode_address` and
  `compute_route_by_coords` (the latter carrying Python's coord-based route
  contract under a different name). Added deliberately in
  `124a615 "align(skills-batch3)"` to give "callers porting Python's geocode-
  then-route-by-coords workflow equivalent capability."
- Verdict: **OPEN** — the *extra* tools are a defensible TS superset, but the
  `compute_route` name carrying a different param contract than the reference is
  a genuine parity break. Reconciling (rename, or realign params) is a focused
  change; deferred.

### weather_api — KEEP (intentional, documented)
- TS uses OpenWeatherMap (`weather_api.ts` header); Python uses WeatherAPI.com
  (`weather_api/skill.py:179`). Same `get_weather` tool shape (`location`
  required), different backend — API keys are not interchangeable. Documented in
  the TS file header and the batch3 commit (`124a615`).
- Verdict: **KEEP** — a deliberate provider choice, flagged for operators. Not a
  contract divergence (the tool shape matches); listed here only so the backend
  difference is on the record.

### Config-validation timing (api_ninjas_trivia, weather_api) — KEEP
- Python validates `api_key` eagerly (raises in `__init__` / `setup()`); TS
  some skills check at handler time and return a "not configured" result.
- Verdict: **KEEP** — observable failure mode is equivalent (the tool can't run
  without the key); the timing difference is idiomatic and low-stakes. Noted for
  completeness.

---

## Cross-cutting: DataMap vs handler

Several Python skills build their tool as a server-side **DataMap** (`data_map`
expressions evaluated by the SignalWire platform): `joke`, `swml_transfer`,
`datasphere_serverless`, `api_ninjas_trivia`, `play_background_file`. Some TS
ports mirror this with a real DataMap (`datasphere_serverless`, `swml_transfer`,
`api_ninjas_trivia` use `data_map.webhooks`), while others implement the same
observable tool with a client-side **handler** (`play_background_file`). Where
the emitted SWAIG `parameters`/`required` match, the model sees the same tool;
the execution model (server-evaluated vs SDK-evaluated) differs. This is tracked
as OPEN where it applies but is lower-stakes than a parameter-contract
divergence.
