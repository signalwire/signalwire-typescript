# PORT_OMISSIONS.md

<!-- ═══════════════════════════════════════════════════════════════════
BEFORE YOU ADD AN ENTRY TO THIS FILE — READ THIS.

Every entry here is a place the parity checker STOPS comparing. That is a real cost:
a divergence you list is a divergence no gate will ever catch again. So entries must
be RARE, and each one must earn its place. Default to skepticism: assume the entry is
NOT needed and make the case that it is.

The order of preference, always:
  1. FIX THE PORT so it matches the reference (add the missing member; make the
     signature match).
  2. FIX THE EMISSION so idiom folds onto the reference shape — the enumerator/emitter
     canonicalizes your language's spelling onto the oracle's (builder → __init__,
     getters → attributes, Result<T,E> → the plain return, CamelCase → the reference
     name, options-object/kwargs → the expanded param list, RAII/dispose → close).
     MOST divergences are idiom and belong here, not in this file.
  3. FIX THE REFERENCE if the oracle itself is wrong or stale (a Python-only symbol
     that leaked into the contract, a param the reference added and the oracle never
     re-enumerated). Fix Python / the oracle, then re-drift — do not paper over a
     broken reference with a per-port entry.
  4. Only when 1–3 genuinely cannot apply does an entry here become justified.

An entry is JUSTIFIED ONLY IF it is irreducible after correct emission — i.e. the
divergence survives because the two languages genuinely cannot express the same thing,
not because the emitter hasn't folded the idiom yet. If emission COULD fold it, the
entry is a bug in this file; go fix the emitter.

Each entry MUST state WHY, concretely, in one of these forms:
  • ADDITION — this symbol exists in the port but not the reference. Answer: is it
    genuine port-only surface with NO reference twin (say what it is and why the
    reference has no equivalent), or is it IDIOM the emitter should have folded (then
    it does not belong here — fold it)? A convenience/alias/back-compat wrapper is NOT
    a justification.
  • OMISSION — this reference symbol has no port member. Answer: WHY can it not exist
    here — what specific language feature is absent (e.g. no async-context-manager
    protocol, no __init__ method protocol)? "impossible:" means the construct cannot
    be expressed at all; if it merely LOOKS different, that's idiom → fold it, don't
    omit it. Cite a precedent when one exists (e.g. RelayClient omits the same dunder).
  • SIGNATURE — the symbol matches by name but its parameters differ. Answer: is the
    difference a foldable idiom collapse (options-object, leading context/self,
    builder) — then EXPAND it in the signature emitter so names+count match, don't list
    it — or a genuine reference-only parameter with no cross-language analogue?

If you cannot write a crisp, specific WHY that survives the "could emission fold this?"
test, the entry is not ready. Prove it's needed before you add it.
════════════════════════════════════════════════════════════════════ -->


This file enumerates every public symbol from `signalwire-python` that the
TypeScript port does NOT implement, with a one-line rationale per symbol.

Each line has the form:

    <fully.qualified.python.symbol>: <rationale>

The `diff_port_surface.py` tool treats every listed symbol as an
intentional omission. Unlisted missing symbols fail the audit.

When a symbol is prefixed with `not_yet_implemented:` the omission is
temporary and a future PR will add it; every other rationale is permanent.

---

## Search subsystem (native RAG / pgvector)

The native vector-search / RAG pipeline is server-side infrastructure:
document ingestion, embedding indices, migration tooling, PG-vector
backend, search CLI. The TypeScript SDK exposes the entry-point skill
(`NativeVectorSearchSkill`) for network-mode queries but does not port
the Python-specific server/CLI tooling. See `PORTING_GUIDE.md § What to Skip`.

## Search subsystem (native RAG / pgvector)


## Bedrock (AWS-specific agent)

# BedrockAgent is now IMPLEMENTED as a real TS AgentBase subclass in
# src/agents/BedrockAgent.ts (class + __init__ + the 6 setters), mirroring the
# Python prefab. Those symbols are PRESENT in port_surface.json and compare
# equal — they are no longer omitted. Only __repr__ (Python object protocol)
# remains omitted, under the "Python dunder methods" section below with an
# `impossible:` reason.

## CLI: init_project


## CLI: dokku


## CLI: simulation / mock env


## CLI: agent/service/argparse loaders


## CLI: build_search


## CLI: execution


## CLI: output formatting


## CLI: test_swaig / swaig_test_wrapper


## CLI: type definitions


## POM module (low-level PromptObjectModel)

# signalwire.pom.pom.PromptObjectModel and signalwire.pom.pom.Section are now
# ported in TS at src/POM/PromptObjectModel.ts (mapped to signalwire.pom.pom).
# The pom_tool CLI helpers remain Python-only.

## MCP gateway backend (server-side MCP router)


## Mixin class identifiers (folded into AgentBase in TS)

signalwire.core.mixins.tool_mixin.ToolMixin.tool: impossible: Python @tool class/instance decorator API; TS registers tools via defineTools()/the tool builder — no decorator-based registration equivalent

## Web-search variants (skill_improved / skill_original)


## Skills: explicit register_tools method

signalwire.skills.mcp_gateway.skill.MCPGatewaySkill.register_tools: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass

# Prefab tool-handler methods are now REFACTORED from inline closures into named
# class methods (checkAvailability / getDirections / searchFaqs / startQuestions /
# submitAnswer / logResponse / validateResponse), each registered via
# `handler: this.<method>.bind(this)`. They are PRESENT in port_surface.json and
# compare equal to the Python prefab handlers — no longer omitted.

## Python dunder methods (no TS equivalent)

signalwire.agents.bedrock.BedrockAgent.__repr__: impossible: Python __repr__ object-protocol; TS has no stringification-protocol member enumerated on the surface
signalwire.core.swaig_function.SWAIGFunction.__call__: impossible: Python callable-object protocol (__call__); TS objects are not callable — the same invocation capability is present verbatim as SWAIGFunction.execute (reconciled)
signalwire.core.swml_builder.SWMLBuilder.__getattr__: impossible: Python dynamic-attribute protocol (__getattr__); TS has no attribute-interception protocol member — SwmlBuilder installs every schema verb at construction (closures over addVerb), so there is no static member to enumerate for this
signalwire.core.swml_service.SWMLService.__getattr__: impossible: Python dynamic-attribute protocol (__getattr__); TS has no attribute-interception protocol member — SWMLService delegates dynamic verbs to its SwmlBuilder's addVerb, with no static member to enumerate
signalwire.relay.call.Call.__repr__: impossible: Python __repr__ object-protocol; TS surfaces its stringification as Call.to_string (a recorded addition), not a __repr__-protocol member
signalwire.relay.client.RelayClient.__aenter__: impossible: Python async-context-manager protocol (__aenter__); TS expresses connect-on-enter via RelayClient.connect() (present verbatim) — there is no snake_case-nameable protocol member for the enter hook
signalwire.relay.client.RelayClient.__aexit__: impossible: Python async-context-manager protocol (__aexit__); TS expresses it via [Symbol.asyncDispose]()→disconnect() (disconnect present verbatim) — the Symbol-keyed disposer has no snake_case surface name
signalwire.relay.client.RelayClient.__del__: impossible: Python finalizer protocol (__del__); TS/JS has no deterministic destructor — cleanup is via disconnect()/[Symbol.asyncDispose] (present verbatim)
signalwire.relay.message.Message.__repr__: impossible: Python __repr__ object-protocol; TS surfaces its stringification as Message.to_string (a recorded addition), not a __repr__-protocol member
signalwire.rest._pagination.PaginatedIterator.__iter__: impossible: Python iterator protocol (__iter__); TS paginates via the paginate() async generator (native AsyncGenerator, Symbol.asyncIterator) — no __iter__-protocol member to enumerate
signalwire.rest._pagination.PaginatedIterator.__next__: impossible: Python iterator protocol (__next__); TS paginate() async generator advances via the native generator protocol — no __next__-protocol member to enumerate

## Individual omissions (case-by-case)

signalwire.core.agent.tools.decorator.ToolDecorator: impossible: Python @tool class/instance decorator API; TS registers tools via defineTools()/the tool builder — no decorator-based registration equivalent
signalwire.core.agent.tools.decorator.ToolDecorator.create_class_decorator: impossible: Python @tool class/instance decorator API; TS registers tools via defineTools()/the tool builder — no decorator-based registration equivalent
signalwire.core.agent.tools.decorator.ToolDecorator.create_instance_decorator: impossible: Python @tool class/instance decorator API; TS registers tools via defineTools()/the tool builder — no decorator-based registration equivalent
signalwire.core.agent.tools.registry.ToolRegistry.register_class_decorated_tools: impossible: Python @tool class/instance decorator API; TS registers tools via defineTools()/the tool builder — no decorator-based registration equivalent
signalwire.core.auth_handler.AuthHandler.flask_decorator: impossible: produces a Flask view decorator; Flask is a Python web framework with no TS equivalent — TS ships the Hono-native AuthHandler.middleware + expressMiddleware instead (recorded additions)
signalwire.core.auth_handler.AuthHandler.get_fastapi_dependency: impossible: produces a FastAPI Depends() dependency; FastAPI is a Python web framework with no TS equivalent — TS ships the Hono-native AuthHandler.middleware instead (recorded addition)
signalwire.core.swml_renderer.SwmlRenderer: impossible: TS folds SWML rendering into SWMLService/AgentBase (AgentBase.renderSwml / SWMLService.render), no separate SwmlRenderer class
signalwire.core.swml_renderer.SwmlRenderer.render_function_response_swml: impossible: TS folds SWML rendering into SWMLService/AgentBase, no separate SwmlRenderer class
signalwire.core.swml_renderer.SwmlRenderer.render_swml: impossible: TS folds SWML rendering into SWMLService/AgentBase, no separate SwmlRenderer class
signalwire.rest._pagination.PaginatedIterator: impossible: TS paginates via the paginate()/paginateAll() async-iterator functions (native AsyncGenerator), no PaginatedIterator class
signalwire.rest._pagination.PaginatedIterator.__init__: impossible: TS paginates via the paginate()/paginateAll() async-iterator functions (native AsyncGenerator), no PaginatedIterator class to construct
signalwire.skills.mcp_gateway.skill.MCPGatewaySkill: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.skills.mcp_gateway.skill.MCPGatewaySkill.get_global_data: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.skills.mcp_gateway.skill.MCPGatewaySkill.get_hints: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.skills.mcp_gateway.skill.MCPGatewaySkill.get_parameter_schema: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.skills.mcp_gateway.skill.MCPGatewaySkill.get_prompt_sections: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.skills.mcp_gateway.skill.MCPGatewaySkill.setup: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.utils.schema_utils.SchemaUtils.generate_method_body: impossible: Python build-time codegen that generates SWML verb-method stubs from schema; TS's verb methods are hand-written/declaration-merged — no runtime method-source generation
signalwire.utils.schema_utils.SchemaUtils.generate_method_signature: impossible: Python build-time codegen that generates SWML verb-method stubs from schema; TS's verb methods are hand-written/declaration-merged — no runtime method-source generation
signalwire.utils.schema_utils.SchemaValidationError: impossible: TS returns a ValidationResult (SchemaUtils.validate → { valid, errors }), no exception class
signalwire.utils.schema_utils.SchemaValidationError.__init__: impossible: TS returns a ValidationResult (SchemaUtils.validate → { valid, errors }), no exception class to construct

## ToolMixin / ToolRegistry (Python uses mixin pattern — TS uses direct methods on SWMLService)


# Per-instance `logger` attributes: RESOLVED 2026-07-25, entries DELETED.
# Owner ruling (ALLOWLIST_DISCIPLINE §8, 2026-07-24): logging is a MODULE-LEVEL
# capability ports may reach however their language does; the per-instance
# `logger`/`log` attribute is NOT contract. The reference dropped it from the
# oracle as a marked, curated exclusion, so the two `impossible:` omissions here
# (SkillManager.logger / SkillRegistry.logger) went DEAD and the TS mirror is now
# dropped symmetrically at the enumerator (PER_INSTANCE_LOGGER_MEMBERS in
# enumerate-surface.ts + enumerate-signatures.ts). Neither ledger carries it.

# SWMLService.on_request is now RECONCILED: the enumerators (surface +
# signatures, in lock-step) project TS's AgentBase.onRequest hook onto
# SWMLService (its base), mirroring Python which declares the default no-op
# `on_request` on both SWMLService and WebMixin. It is PRESENT in
# port_surface.json — no longer omitted. (The signature type divergence — TS
# types the body param as SwmlRequestData vs Python's Optional[Dict] — is
# recorded in PORT_SIGNATURE_OMISSIONS.md, same as the WebMixin projection.)

## Webhook signature validation: framework-specific adapter

signalwire.core.security.webhook_middleware.make_webhook_validation_dependency: impossible: produces a FastAPI Depends() dependency; FastAPI is a Python web framework with no TS equivalent — the TS port ships the equivalent Hono middleware `webhook_validation_middleware` from the same module (recorded addition). Both wrap the same validateWebhookSignature core.

# RELAY abstract action mixin bases: RECONCILED. The oracle (porting-sdk @ 5744580)
# no longer emits StoppableAction/PausableAction/VolumeAction as cross-port symbols —
# it projects their control methods directly onto the concrete actions. TS's inlined
# concrete methods now compare equal, so there is nothing to omit for the vanished bases.


# relay_rest PhoneCallHandler is now RECONCILED: the surface enumerator projects
# TS's `export const PhoneCallHandler` (src/rest/callHandler.ts, the `call_handler`
# value enum) as a bare method-less class under the reference's generated-type
# module `signalwire.rest.namespaces.relay_rest_types_generated.PhoneCallHandler`.
# It is PRESENT in port_surface.json and compares equal — no longer omitted.

## AgentServer.agents (private field + accessor idiom)

signalwire.agent_server.AgentServer.agents: impossible: the reference AgentServer exposes TWO distinct members — `agents` (a public dict<string,AgentBase> attribute) AND `get_agents` (a method returning list<tuple<string,AgentBase>>). The TS port's `get_agents` accessor already matches the reference's `get_agents` by name+shape; there is no SECOND distinct TS member to map to the raw `agents` dict (TS keeps the map private and publishes only the get_agents/get_agent accessors). A rename get_agents→agents would ORPHAN the reference's get_agents. So the raw-dict `agents` attribute genuinely has no TS twin — not a foldable rename.

## A-mixin fold surface keys + envelope idiom (wave-2)

agentbase-family.tool: impossible: Python @tool class/instance decorator API (ToolMixin.tool); TS registers tools via defineTools()/the tool builder — no decorator-based registration equivalent. (A-mixin fold surface key; unfolded twin at signalwire.core.mixins.tool_mixin.ToolMixin.tool.)
signalwire.rest._request_options.RequestOptions.abort_signal: impossible: Python's RequestOptions.abort_signal returns an SDK-class `_AbortSignal` accessor bound to asyncio cancellation; TS carries the field as the native platform `AbortSignal` (RequestOptions.abortSignal, passed straight to fetch), which is NOT projected as an SDK-class-returning accessor — so the reference's SDK-class `abort_signal` accessor has no matching TS surface member. SURFACE-oracle-invisible (only merge()/__init__ are in the TS surface oracle). Same disposition as go's abort_signal.

