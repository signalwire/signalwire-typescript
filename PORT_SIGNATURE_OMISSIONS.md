# PORT_SIGNATURE_OMISSIONS.md

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


Documented signature divergences between this TypeScript port and the
Python reference. Names-only divergences live in PORT_OMISSIONS.md /
PORT_ADDITIONS.md and are inherited automatically.

Format:
    <fully.qualified.symbol>: <one-line rationale>

Every excused divergence below names a specific, honest reason. There is no
"backlog": each entry is a genuine, permanent language/framework idiom, a
reference-oracle enumeration gap, a port-only addition, or a case where the TS
type is strictly *richer* than the reference (same wire). Excused divergences
fall into these named categories:

1. **Idiom-level** (deliberate, not fixable without breaking TS API style):
   - TS constructors take TS-shaped option objects rather than Python kwargs.
   - TS methods return ``this`` for fluent chaining; Python returns None.
   - TS optional parameters use ``?`` syntax; carrying defaults differs.
   - **ts-options-object**: a single trailing options object collapses a Python
     method's positional-or-keyword arguments. The enumerator unfolds the object
     to keyword params where the Python reference is keyword-only (so they match);
     where the reference is positional-or-keyword the residual param-KIND mismatch
     is this idiom (the options object is a keyword-passing bag; it cannot express
     Python's positional affordance). Same wire, same value set — the analog of
     Go's `go-variadic-options`.
   - **framework / typed-shape**: TS types payloads/returns as named shapes where
     Python uses ``dict``/``Any`` (TS strictly richer — never loosened; same
     emitted wire, proven by EMISSION).
     NOTE (2026-07-28): THREE claims this bullet used to make were all wrong and
     have been retired, not re-excused — reconciled in the type/module tables and
     in the port's own source so comparison KEEPS RUNNING instead of stopping:
       * "TS omits FastAPI wrapper types (``HTTPBasicCredentials`` /
         ``HTTPAuthorizationCredentials``) that have no Hono/TS analog" — FastAPI
         was never the contract. Those objects are just the fields parsed out of
         the ``Authorization`` header, and that shape is fully portable. porting-sdk
         dcff742 publishes them as real oracle classes
         (``BasicCredentials`` {username, password} / ``BearerCredentials``
         {scheme, credentials}); ``src/AuthHandler.ts`` now declares exactly those
         two carriers and ``verifyBasicAuth``/``verifyBearerToken`` take them, so
         both methods COMPARE EQUAL instead of being excused.
       * "FastAPI ``Request`` has no Hono/TS analog" — it does. Hono's per-request
         ``Context`` is that analog, and go already maps its ``http.Request`` and
         compares equal. ``Context`` now maps to ``class:Request`` in
         porting-sdk/type_aliases.yaml (the differ matches bare class refs by leaf).
       * "TS types payloads as named shapes where Python uses dict, so they cannot
         compare" — the diff checker has ALWAYS held a spec-generated TypedDict
         compatible with ``dict<string,any>`` in either direction. That rule simply
         never fired, because this port's SIGNATURE enumerator was missing the
         ``src/PlatformContracts.generated.ts`` module alias its own SURFACE
         enumerator already had, so ``SwmlRequestData`` never normalised to the
         ``gen:<Name>`` token the rule keys on. Adding the alias retired 12 excuses
         with zero new drift.

2. **Reference-oracle gaps**: symbols the port genuinely implements but that are
   absent from ``python_signatures.json`` (griffe enumeration gaps — e.g. the
   whole ``signalwire.livewire`` module, and per-skill ``get_parameter_schema``
   accessors whose skill class the oracle records no signatures for).

3. **Port additions**: TS-only helpers with no Python-reference counterpart
   (CLI loaders, pagination helpers, compile-time tool-typing helpers, file-
   co-located registries).


## Idiom: TS constructors

signalwire.core.pom_builder.PomBuilder.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.Agent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.AgentServer.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.AgentSession.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.CartesiaTTS.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.DeepgramSTT.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.ElevenLabsTTS.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.LLM.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.OpenAILLM.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.RunContext.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.STT.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.SileroVAD.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.StopResponse.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.TTS.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.ToolError.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs

## Idiom: TS named collection/result types vs the reference's bare dicts + tuples

# NOTE (2026-07-29): every rationale in this section used to read "TS fluent API
# returns this for chaining". That was FALSE for all eight — not one of these TS
# methods returns `this` (`getAgents(): Map<...>`, `createPaymentAction():
# PaymentAction`, `getSection(): PomSection | undefined`, `toDict():
# PomSectionData[]`, `debugToken(): DebugTokenResult`, `getPromptSections():
# SkillPromptSection[]`). The divergences each entry suppresses ARE real, so the
# entries stay; only the wording is corrected to name the actual divergence the
# differ reports.

signalwire.agent_server.AgentServer.get_agents: TS getAgents() returns the live `Map<string, AgentBase>` registry; the reference returns `list<tuple<string, AgentBase>>`. Same (name, agent) pairs, TS's native keyed-collection type instead of a list of 2-tuples (TS has no tuple-of-pairs idiom for a registry).
signalwire.core.function_result.FunctionResult.create_payment_action: TS createPaymentAction() returns the named `PaymentAction` interface; the reference returns the equivalent `dict<string,string>`. Same SWAIG payload object, TS stricter.
signalwire.core.function_result.FunctionResult.create_payment_parameter: TS createPaymentParameter() returns the named `PaymentParameter` interface; the reference returns the equivalent `dict<string,string>`. Same SWAIG payload object, TS stricter.
signalwire.core.pom_builder.PomBuilder.get_section: TS getSection() returns `PomSection | undefined` (the port's own section class); the reference returns `optional<signalwire.pom.pom.Section>`. Same section object, the port's co-located PomSection class instead of the pom.pom one.
signalwire.core.pom_builder.PomBuilder.to_dict: TS toDict() returns `list<PomSectionData>` (a named shape); the reference returns the equivalent `list<dict<string,any>>`. Same JSON, TS stricter.
signalwire.core.security.session_manager.SessionManager.debug_token: TS debugToken() returns the named `DebugTokenResult` shape; the reference returns the equivalent `dict<string,any>`. Same decoded-token fields, TS stricter.
signalwire.core.skill_base.SkillBase.get_prompt_sections: TS getPromptSections() returns `list<SkillPromptSection>` (a named shape); the reference returns the equivalent `list<dict<string,any>>`. Same prompt sections, TS stricter.
signalwire.skills.registry.SkillRegistry.list_skills: the reference's `SkillRegistry.list_skills` has no port member under this name: TS's `listSkills()` is enumerated as the port twin of `discover_skills` (see that entry), so `list_skills` itself reads missing-port. Same listing capability, reached through the discover_skills mapping.

## Idiom: TS options-object vs Python positional-or-keyword params


## Idiom: TS options-object serve/run collapse


## Idiom: TS typed payload/shape vs Python dict (TS stricter, same wire)

signalwire.core.mixins.ai_config_mixin.AIConfigMixin.set_function_includes: TS types the param as list<FunctionInclude> (named shape); Python uses list[dict[str,Any]]. Same wire, TS stricter — do not loosen.
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.set_languages: TS types the param as list<LanguageConfig> (named shape); Python uses list[dict[str,Any]]. Same wire, TS stricter.
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.set_pronunciations: TS types the param as list<PronunciationRule> (named shape); Python uses list[dict[str,Any]]. Same wire, TS stricter.
signalwire.core.function_result.FunctionResult.create_payment_prompt: TS types actions as list<PaymentAction> and returns PaymentPrompt (named shapes of the same dicts Python takes/returns as dict[str,Any]/list[dict[str,str]]). Same SWAIG wire, TS stricter both directions.
signalwire.core.swaig_function.SWAIGFunction.execute: TS returns the typed SwaigResultDict ({response?,action?,post_process?}); Python returns the equivalent dict[str,Any]. Same SWAIG response JSON, TS stricter.
signalwire.core.pom_builder.PomBuilder.from_sections: TS types the sections param as list<PomSectionData> (named shape); Python uses list[dict[str,Any]]. Same structure, TS stricter. (cls receiver reconciled in the enumerator.)
signalwire.skills.registry.SkillRegistry.discover_skills: TS listSkills() (≡ discover_skills) returns list<SkillSchemaInfo> (named shape); Python returns list[dict[str,str]]. Same metadata, TS stricter.
signalwire.skills.api_ninjas_trivia.skill.ApiNinjasTriviaSkill.get_tools: TS getTools() returns list<SkillToolDefinition> (named shape); Python returns list[dict[str,Any]]. Same tool defs, TS stricter.
signalwire.skills.play_background_file.skill.PlayBackgroundFileSkill.get_tools: TS getTools() returns list<SkillToolDefinition>; Python returns list[dict[str,Any]]. Same tool defs, TS stricter.
signalwire.skills.weather_api.skill.WeatherApiSkill.get_tools: TS getTools() returns list<SkillToolDefinition>; Python returns list[dict[str,Any]]. Same tool defs, TS stricter.
signalwire.core.swml_service.SWMLService.extract_sip_username: TS types request_body as SwmlRequestData (the canonical dynamic-SWML request shape); Python types it dict[str,Any]. Same payload, TS stricter.
signalwire.core.mixins.web_mixin.WebMixin.set_dynamic_config_callback: TS callback's 2nd arg is typed SwmlRequestData (canonical dynamic-SWML request); Python types it dict[str,Any]. Same callback contract, TS stricter payload.
signalwire.prefabs.info_gatherer.InfoGathererAgent.set_question_callback: TS callback receives a typed SwmlRequestData + returns list<InfoGathererQuestion> (named shapes) where Python uses dicts. Same callback contract, TS stricter.

## Idiom: TS richer return / method-split (superset or parity shim)

signalwire.core.agent.prompt.manager.PromptManager.get_prompt: TS splits Python's polymorphic get_prompt (str|list[dict]|None) into typed methods: getPrompt() -> string (rendered Markdown, '' not null) and getPromptPom()/getRawPrompt() for the list/None branches. get_prompt returns string by design.
signalwire.core.mixins.prompt_mixin.PromptMixin.get_prompt: TS splits Python's polymorphic get_prompt into getPrompt() -> string (rendered Markdown) and getPromptPom() for the list branch (documented at AgentBase.ts). Agent-level getPrompt returns string.
signalwire.core.mixins.skill_mixin.SkillMixin.list_skills: TS listSkills() returns richer per-instance descriptors ({name,instanceId,initialized}[]) vs Python's list[str] of names. Same skill set; the name field is the Python-equivalent data. In-process return, TS superset.
signalwire.core.mixins.skill_mixin.SkillMixin.remove_skill: TS removeSkill(instanceId) -> Promise<boolean> removes by instance id and reports success; Python remove_skill returns self (fluent). TS provides removeSkillByName for by-name parity. Deliberate API redesign (by-id + boolean), documented.
signalwire.core.skill_base.SkillBase.validate_env_vars: TS validateEnvVars() -> string[] returns the MISSING var names (more informative); Python returns bool. TS provides hasAllEnvVars() -> boolean for exact bool parity. TS richer with a parity shim.
signalwire.core.skill_base.SkillBase.validate_packages: TS validatePackages() -> Promise<string[]> returns the MISSING package names; Python returns bool. TS provides hasAllPackages() -> boolean for exact bool parity. TS richer with a parity shim.
signalwire.utils.schema_utils.SchemaUtils.validate_verb: TS validate() returns a structured ValidationResult object; Python validate_verb returns a (bool, list[str]) tuple. Same validation capability, TS-idiomatic structured return.
signalwire.core.mixins.prompt_mixin.PromptMixin.define_contexts: Python define_contexts returns AgentBase|ContextBuilder (self when a contexts arg is passed, else the ContextBuilder); TS always returns ContextBuilder. The ContextBuilder branch is the value-building path used by TS callers; the fluent-agent branch is served by returning `this` from the agent-level builder entry. Same capability, single-return TS shape.

## Idiom: framework / language-idiom param divergences (same wire/behavior)

signalwire.core.agent_base.AgentBase.on_debug_event: Python on_debug_event is a decorator that registers and returns a handler (Callable->Callable); TS onDebugEvent(event) is the idiomatic overridable receiver hook that consumes the event and returns void. Same debug-event capability, different (Pythonic vs OO) registration mechanism.
signalwire.core.swaig_function.SWAIGFunction.to_swaig: TS toSwaig(base_url, token, call_id) omits Python's include_auth flag (auth inclusion is derived from token presence in the TS emitter); same emitted SWAIG entry.
signalwire.relay.call.Call.clear_digit_bindings: TS clearDigitBindings(realm?) takes realm positionally where Python makes it keyword-only (`*, realm`); same clear-bindings wire command with the same field. (The reference also carries a `**kwargs` passthrough, but the oracle strips the kwargs tail, so the param-KIND difference is the whole of what the differ reports.)
signalwire.relay.call.Call.send_digits: TS sendDigits(digits, controlId?) takes control_id positionally where Python makes it keyword-only; same send_digits wire command with the same fields.
signalwire.relay.call.Call.amazon_bedrock: TS amazonBedrock(options) types the collapsed prompt as required-in-context where Python records Optional[Any]; both accept the same open prompt value and POST the identical amazon_bedrock params.
signalwire.rest._request_options.RequestOptions.abort_signal: field-vs-accessor idiom: the reference dataclass surfaces abort_signal as a read accessor; TS carries it as a public readonly field on the RequestOptions value object (RequestOptions.abortSignal). Same value, read the same way — a TS field is the idiomatic analog of a Python dataclass field.

## Reference-oracle gap: signalwire.livewire not in the signatures oracle

signalwire.livewire.Agent.llm_node: reference-oracle gap: signalwire.livewire is absent from python_signatures.json (a known griffe enumeration gap that php and go also hit). The port implements the LiveWire compatibility shim, so these methods enumerate on the port side with no reference signature to compare.
signalwire.livewire.Agent.on_user_turn_completed: reference-oracle gap: signalwire.livewire is absent from python_signatures.json (a known griffe enumeration gap that php and go also hit). The port implements the LiveWire compatibility shim, so these methods enumerate on the port side with no reference signature to compare.
signalwire.livewire.Agent.session: reference-oracle gap: signalwire.livewire is absent from python_signatures.json (a known griffe enumeration gap that php and go also hit). The port implements the LiveWire compatibility shim, so these methods enumerate on the port side with no reference signature to compare.
signalwire.livewire.Agent.stt_node: reference-oracle gap: signalwire.livewire is absent from python_signatures.json (a known griffe enumeration gap that php and go also hit). The port implements the LiveWire compatibility shim, so these methods enumerate on the port side with no reference signature to compare.
signalwire.livewire.Agent.tts_node: reference-oracle gap: signalwire.livewire is absent from python_signatures.json (a known griffe enumeration gap that php and go also hit). The port implements the LiveWire compatibility shim, so these methods enumerate on the port side with no reference signature to compare.
signalwire.livewire.Agent.update_instructions: reference-oracle gap: signalwire.livewire is absent from python_signatures.json (a known griffe enumeration gap that php and go also hit). The port implements the LiveWire compatibility shim, so these methods enumerate on the port side with no reference signature to compare.
signalwire.livewire.Agent.update_tools: reference-oracle gap: signalwire.livewire is absent from python_signatures.json (a known griffe enumeration gap that php and go also hit). The port implements the LiveWire compatibility shim, so these methods enumerate on the port side with no reference signature to compare.
signalwire.livewire.AgentServer.rtc_session: reference-oracle gap: signalwire.livewire is absent from python_signatures.json (a known griffe enumeration gap that php and go also hit). The port implements the LiveWire compatibility shim, so these methods enumerate on the port side with no reference signature to compare.
signalwire.livewire.AgentSession.generate_reply: reference-oracle gap: signalwire.livewire is absent from python_signatures.json (a known griffe enumeration gap that php and go also hit). The port implements the LiveWire compatibility shim, so these methods enumerate on the port side with no reference signature to compare.
signalwire.livewire.AgentSession.say: reference-oracle gap: signalwire.livewire is absent from python_signatures.json (a known griffe enumeration gap that php and go also hit). The port implements the LiveWire compatibility shim, so these methods enumerate on the port side with no reference signature to compare.
signalwire.livewire.AgentSession.start: reference-oracle gap: signalwire.livewire is absent from python_signatures.json (a known griffe enumeration gap that php and go also hit). The port implements the LiveWire compatibility shim, so these methods enumerate on the port side with no reference signature to compare.
signalwire.livewire.AgentSession.update_agent: reference-oracle gap: signalwire.livewire is absent from python_signatures.json (a known griffe enumeration gap that php and go also hit). The port implements the LiveWire compatibility shim, so these methods enumerate on the port side with no reference signature to compare.
signalwire.livewire.ChatContext.append: reference-oracle gap: signalwire.livewire is absent from python_signatures.json (a known griffe enumeration gap that php and go also hit). The port implements the LiveWire compatibility shim, so these methods enumerate on the port side with no reference signature to compare.
signalwire.livewire.JobContext.wait_for_participant: reference-oracle gap: signalwire.livewire is absent from python_signatures.json (a known griffe enumeration gap that php and go also hit). The port implements the LiveWire compatibility shim, so these methods enumerate on the port side with no reference signature to compare.
signalwire.livewire.SileroVAD.load: reference-oracle gap: signalwire.livewire is absent from python_signatures.json (a known griffe enumeration gap that php and go also hit). The port implements the LiveWire compatibility shim, so these methods enumerate on the port side with no reference signature to compare.
signalwire.livewire.run_app: reference-oracle gap: signalwire.livewire is absent from python_signatures.json (a known griffe enumeration gap that php and go also hit). The port implements the LiveWire compatibility shim, so these methods enumerate on the port side with no reference signature to compare.
signalwire.livewire.tool: reference-oracle gap: signalwire.livewire is absent from python_signatures.json (a known griffe enumeration gap that php and go also hit). The port implements the LiveWire compatibility shim, so these methods enumerate on the port side with no reference signature to compare.

## Reference-oracle gap: per-skill get_parameter_schema (no class in the oracle)

signalwire.skills.api_ninjas_trivia.skill.ApiNinjasTriviaSkill.get_parameter_schema: reference-oracle gap: the Python signatures oracle records no class for this skill module, so the port's static get_parameter_schema accessor has no reference method to compare (same shape as the SwmlTransferSkill.get_parameter_schema entry already carried).
signalwire.skills.play_background_file.skill.PlayBackgroundFileSkill.get_parameter_schema: reference-oracle gap: the Python signatures oracle records no class for this skill module, so the port's static get_parameter_schema accessor has no reference method to compare (same shape as the SwmlTransferSkill.get_parameter_schema entry already carried).
signalwire.skills.spider.skill.SpiderSkill.get_parameter_schema: reference-oracle gap: the Python signatures oracle records no class for this skill module, so the port's static get_parameter_schema accessor has no reference method to compare (same shape as the SwmlTransferSkill.get_parameter_schema entry already carried).
signalwire.skills.weather_api.skill.WeatherApiSkill.get_parameter_schema: reference-oracle gap: the Python signatures oracle records no class for this skill module, so the port's static get_parameter_schema accessor has no reference method to compare (same shape as the SwmlTransferSkill.get_parameter_schema entry already carried).
signalwire.skills.wikipedia_search.skill.WikipediaSearchSkill.get_parameter_schema: reference-oracle gap: the Python signatures oracle records no class for this skill module, so the port's static get_parameter_schema accessor has no reference method to compare (same shape as the SwmlTransferSkill.get_parameter_schema entry already carried).

## Port additions / co-location: in port, not in the signatures oracle

signalwire.cli.agent_loader.list_agents: TS-only CLI helper (offline agent loader for swaig-test); no Python equivalent in the signatures oracle.
signalwire.cli.agent_loader.load_agent: TS-only CLI helper (offline agent loader for swaig-test); no Python equivalent.
signalwire.cli.mock_data.generate_fake_post_data: TS-only CLI helper (swaig-test mock POST data); no Python equivalent.
signalwire.cli.mock_data.generate_minimal_post_data: TS-only CLI helper (swaig-test mock POST data); no Python equivalent.
signalwire.core.agent.tools.type_inference.create_typed_handler_wrapper: ts-idiom typed-handler wrapper — same capability as the oracle's create_typed_handler_wrapper, but TS cannot runtime-reflect a handler's parameter names (JS erases them), so it takes an explicit `param_names: list<string>` and wraps a typed `(args, rawData) -> FunctionResult` handler. The extra param and the concrete FunctionResult return type are the static-typed rendering of the same runtime helper.
signalwire.core.agent.tools.type_inference.infer_schema: ts-idiom typed-params builder — same capability as the oracle's infer_schema, but TS returns a single `InferredSchema` struct (properties + required + description) instead of Python's positional 5-tuple. Idiom: a static port builds a named result object where the runtime port returns a bare tuple; the schema content is identical.
signalwire.core.agent_base.AgentBase.setup_graceful_shutdown: TS static setupGracefulShutdown({timeout}) projected onto AgentBase; the reference declares it on WebMixin (reconciled there). This AgentBase-level entry is the TS static form with no separate reference method.
signalwire.core.swml_service.VerbHandlerRegistry.get_handler: TS VerbHandlerRegistry (co-located in SWMLService.ts) exposes get/has/register handler accessors; the reference records these on swml_handler.VerbHandlerRegistry, not the swml_service one. Same registry capability, TS file co-location.
signalwire.core.swml_service.VerbHandlerRegistry.has_handler: TS VerbHandlerRegistry accessor co-located in SWMLService.ts; reference records it on swml_handler.VerbHandlerRegistry. Same capability.
signalwire.core.swml_service.VerbHandlerRegistry.register_handler: TS VerbHandlerRegistry accessor co-located in SWMLService.ts; reference records it on swml_handler.VerbHandlerRegistry. Same capability.
signalwire.list_skills: TS-only top-level list_skills convenience export; the reference exposes signalwire.functions.list_skills_with_params and SkillRegistry.list_skills, not a bare module-level list_skills.
signalwire.core.skill_manager.SkillManager.add_skill: TS-only SkillManager.addSkill convenience (register a pre-instantiated skill); the reference SkillManager uses load_skill. Additive.
signalwire.rest.pagination.paginate: TS-only pagination helper; no Python signatures-oracle equivalent (Python paginates via iterator protocol).
signalwire.rest.pagination.paginate_all: TS-only pagination helper; no Python signatures-oracle equivalent.
signalwire.skills.builtin.index.register_builtin_skills: TS-only built-in-skill registration index; no Python signatures-oracle equivalent (Python auto-discovers skills).
signalwire.skills.registry.SkillRegistry.add_search_path: TS-only SkillRegistry helper (add a directory to scan); the reference registry discovers differently. Additive.
signalwire.skills.registry.SkillRegistry.discover_from_directory: TS-only SkillRegistry helper (scan a directory); additive over the reference's discovery.
signalwire.prefabs.concierge.ConciergeAgent.on_summary: TS prefab onSummary override; the reference prefab's on_summary is not in the signatures oracle (prefab methods enumerated on the port side only). Same summary hook.
signalwire.prefabs.faq_bot.FAQBotAgent.on_summary: TS prefab onSummary override; the reference prefab's on_summary is not in the signatures oracle. Same summary hook.
signalwire.prefabs.receptionist.ReceptionistAgent.on_summary: TS prefab onSummary override; the reference prefab's on_summary is not in the signatures oracle. Same summary hook.
signalwire.prefabs.survey.SurveyAgent.on_summary: TS prefab onSummary override; the reference prefab's on_summary is not in the signatures oracle. Same summary hook.
signalwire.core.mixins.tool_mixin.ToolMixin.define_tools: TS deliberately splits Python's public define_tools() (returns the SWAIG-function list) into a protected void defineTools() setup hook + getTools() list accessor; the list-returning half is getTools (documented at AgentBase.ts). No single define_tools returning-a-list method to sign.
signalwire.core.mixins.web_mixin.WebMixin.setup_graceful_shutdown: TS setupGracefulShutdown is a static method ({timeout} option) rather than an instance method; the reference WebMixin.setup_graceful_shutdown is instance/no-arg. Same SIGTERM/SIGINT cleanup capability, TS static form.


## Idiom: TS file co-locates support classes (return-type module path differs)

The TS port keeps `SecurityConfig` and `VerbHandlerRegistry` declared
inside `SWMLService.ts` rather than in a dedicated file like Python's
`security_config.py` / `swml_handler.py`. Public `security` /
`verb_registry` getters return the same conceptual class but the
canonical path differs.


## TS-idiomatic return-type divergences

# EMPTY as of 2026-07-27. The sole entry here was
# `signalwire.core.skill_base.SkillBase.logger`, deleted in the Wave-6 ledger
# burn-down. Owner ruling 2026-07-24 (ALLOWLIST_DISCIPLINE §8): logging is a
# MODULE-LEVEL capability, and the per-instance `logger` attribute was Python's
# structlog idiom leaking into the enumerated surface — not contract. The
# reference enumerator now suppresses it at the logging factory's RETURN TYPE
# (`enumerate_python.py` `_LOGGER_FACTORY_RETURN`), so the oracle emits no
# class-attribute `logger` for this exemption to excuse. The capability is
# signalled by the 5 module-level free functions in
# `signalwire.core.logging_config` (get_logger / configure_logging /
# get_execution_mode / reset_logging_configuration / strip_control_chars),
# which the TS port implements.

## TS-idiomatic params-object vs **kwargs

signalwire.pom.pom.PromptObjectModel.add_section: TS PromptObjectModel.addSection takes (title, opts) where opts={ body, bullets, numbered, numberedBullets } — mirrors Python's keyword-only params after `title`. Same call-site contract.
signalwire.pom.pom.Section.add_subsection: TS Section.addSubsection takes (title, opts) where opts={ body, bullets, numbered, numberedBullets } — mirrors Python's keyword-only params after `title`. Same call-site contract.

## POM int vs float (TS has no integer type)


## POM SectionData vs dict<string,any>

signalwire.pom.pom.PromptObjectModel.to_dict: TS returns `list<class:signalwire.pom.pom.SectionData>` where SectionData is a typed shape; Python returns the equivalent `list<dict<string,any>>`. Same JSON-serializable structure with stronger TS typing.
signalwire.pom.pom.Section.to_dict: TS returns `class:signalwire.pom.pom.SectionData` (the typed shape of one serialized section); Python returns the equivalent `dict<string,any>`. Same JSON, stronger TS typing. (Python's return type was firmed up from bare `any` to `dict<string,any>` during the mypy pass; TS already modeled the precise SectionData shape.)

## Typed payload/serializer shapes vs dict<string,any> (idiomatic TS, same wire)

Where Python types a webhook payload or serializer output as `Dict[str, Any]`, the
TS port captures the actual wire shape as a named interface (sourced from the
canonical backend contract / the serializer itself). Same JSON structure, byte-
identical emission (proven by the EMISSION gate); the TS type is strictly richer.
Per-port idiom: TS prefers a named shape over an opaque dict.

signalwire.core.contexts.Context.to_dict: TS returns `class:...ContextDict` (named shape of the emitted context dict); Python returns the equivalent `dict<string,any>`. Same JSON, stronger TS typing.
signalwire.core.contexts.GatherInfo.to_dict: TS returns `class:...GatherInfoDict`; Python returns the equivalent `dict<string,any>`. Same JSON, stronger TS typing.
signalwire.core.contexts.Step.to_dict: TS returns `class:...StepDict`; Python returns the equivalent `dict<string,any>`. Same JSON, stronger TS typing.
signalwire.core.function_result.FunctionResult.to_dict: TS returns `class:...SwaigResultDict` (typed `{response?, action?, post_process?}`); Python returns the equivalent `dict<string,any>`. Same SWAIG response JSON, stronger TS typing.
signalwire.core.mixins.web_mixin.WebMixin.on_request: TS types the request body param as `class:...SwmlRequestData` (the canonical dynamic-SWML request shape, swml.md); Python types it `Optional[Dict[str, Any]]`. Same payload, stronger TS typing.
signalwire.core.swml_service.SWMLService.on_request: TS types the request body param as `class:...SwmlRequestData` (the canonical dynamic-SWML request shape, swml.md); Python types it `Optional[Dict[str, Any]]`. Same payload, stronger TS typing. (Same AgentBase.onRequest hook projected onto SWMLService, the reference's base declaration.)
signalwire.core.skill_base.SkillBase.get_skill_data: TS types the raw_data param as `class:...SwaigRequestData` (the canonical SWAIG-webhook request shape, swml.md); Python types it `Dict[str, Any]`. Same payload, stronger TS typing.


## Command-dispatch `action` union: griffe right-nests, TS emits a flat union

These two generated `calling` command-dispatch methods take an `action` param whose
spec type is an `anyOf` of named action variants. Both ports type it identically (the
exact same set of generated action types); the divergence is purely how each language's
enumerator RENDERS the union: Python's griffe emits a right-nested `A | (B | C)` shape
(`union<Stop,union<Start,Summarize>>`), while the TS TypeChecker / enumerator emits a
flat `union<Start,Summarize,Stop>`. The diff's `normalize_type` sorts union members but
does not flatten a nested union, so the flat-vs-nested spelling reads as a mismatch. A
union is associative + commutative, so both spellings accept the identical set of values
and POST the identical wire `params.action`. (Pre-existing since the foundation's
command-dispatch emitter; not introduced by the client-tree roll.)


## Surface-reconciled symbols: signature-shape / projection divergences

These symbols are reconciled to PRESENT in the surface audit (idiom-mapped in the
enumerators so they compare equal by name); the signature-level divergence below is
the residual idiom difference (TS declaration-merge / projection / callback shape),
not a functional gap.

signalwire.core.mixins.mcp_server_mixin.MCPServerMixin.add_mcp_server: idiom: reference MCPServerMixin is an empty class; TS folds MCP helpers onto AgentBase and the signatures enumerator projects add_mcp_server onto the mixin — a port-only projection with no reference method
signalwire.core.mixins.prompt_mixin.PromptMixin.contexts: idiom: Python exposes `contexts` as a property on the mixin; TS surfaces the same capability via AgentBase/PromptManager.getContexts() (get_contexts), reconciled by name in the surface audit
signalwire.core.mixins.serverless_mixin.ServerlessMixin.handle_serverless_request: idiom: TS expresses this as AgentBase.runServerless() (reconciled by name to handle_serverless_request in the surface audit); the signature shape is TS-idiomatic
signalwire.core.skill_base.SkillBase.register_tools: idiom: TS skills use the declarative getTools() contract (get_tools), reconciled by name to register_tools in the surface audit; no separate imperative register_tools method exists to sign
signalwire.core.swml_builder.SWMLBuilder.ai: idiom: SwmlBuilder installs every schema verb dynamically at construction + declares them via a generated declaration-merge interface; the config-object param shape differs from Python's positional convenience-wrapper params (same as the existing SWMLBuilder.say idiom entry)
signalwire.core.swml_builder.SWMLBuilder.answer: idiom: dynamically-installed/declaration-merged verb method; config-object param shape vs Python positional wrapper params
signalwire.core.swml_builder.SWMLBuilder.hangup: idiom: dynamically-installed/declaration-merged verb method; config-object param shape vs Python positional wrapper params
signalwire.core.swml_builder.SWMLBuilder.play: idiom: dynamically-installed/declaration-merged verb method; config-object param shape vs Python positional wrapper params
signalwire.skills.swml_transfer.skill.SWMLTransferSkill.get_parameter_schema: idiom: TS static get_parameter_schema accessor; the reference SIGNATURES oracle records no class for this skill module (same shape as the other per-skill get_parameter_schema idiom entries)
signalwire.utils.schema_utils.SchemaUtils.validate_document: idiom: TS validate() returns a ValidationResult object (structured), Python validate_document returns a (bool, list[str]) tuple — same validation capability, TS-idiomatic return

## BedrockAgent: present in the surface oracle, absent from the signatures oracle

The Python reference records `signalwire.agents.bedrock.BedrockAgent` in
`python_surface.json` (the surface gate requires it) but NOT in
`python_signatures.json` (the signatures enumerator did not capture the class).
The TS port implements BedrockAgent as a real AgentBase subclass
(src/agents/BedrockAgent.ts), so its methods are enumerated on the port side but
have no reference signature to compare against (missing-reference). Excused here
until the reference signatures oracle carries BedrockAgent.

signalwire.agents.bedrock.BedrockAgent.set_post_prompt_llm_params: reference signatures oracle records no BedrockAgent class (present only in the surface oracle); port implements it — no reference signature to compare
signalwire.agents.bedrock.BedrockAgent.set_prompt_llm_params: reference signatures oracle records no BedrockAgent class (present only in the surface oracle); port implements it — no reference signature to compare

## UNRESOLVED — real capability gap awaiting an owner ruling (NOT idiom)

# `signalwire.agent_server.AgentServer.logger` was deleted here 2026-07-27 (Wave-6
# ledger burn-down) for the same reason as SkillBase.logger above: the reference
# enumerator suppresses the per-instance logger member by the logging factory's
# return type, so the oracle no longer emits the symbol this line excused.
#
# WebService.security — the rationale that stood here until 2026-07-28 was FALSE and
# is corrected below rather than re-excused. It claimed this was "only the config
# class-name spelling" across a rename. The source says otherwise:
#   * TS ALREADY HAS a `SecurityConfig` class (src/SWMLService.ts) that is a faithful
#     analog of the reference's — SSL + basic auth + allowed hosts + CORS origins +
#     HSTS. It is real and in use by SWMLService. So there is no missing class and no
#     class-name divergence to fold; the two names denote two DIFFERENT objects.
#   * `WebService` simply does not use it: it holds `_ssl: SslConfig` and its
#     `security` accessor returns that. `SslConfig` covers SSL/HSTS ONLY.
#   * The reference's `SecurityConfig` exposes 7 public capabilities —
#     get_cors_config, get_security_headers, should_allow_host, get_basic_auth,
#     get_ssl_context_kwargs, validate_ssl_config, log_config. Through TS's
#     `WebService.security` a caller can reach NONE of the CORS / security-headers /
#     host-allowlist / basic-auth ones.
# This is therefore a genuine NARROWING of a public accessor, not a rename: the
# reference hands back the unified security object, the port hands back an SSL-only
# subset. It is NOT foldable at the emitter and it is NOT a language ceiling —
# TypeScript can express it, and the class already exists.
#
# Closing it is a behavioural change to WebService (swap the `_ssl` field for a
# `SecurityConfig`, and add the `isConfigured()` / `hstsMiddleware()` /
# `getServerOptions()` affordances that `WebService` calls on `_ssl` today and that
# `SecurityConfig` does not currently expose). That is a deliberate API change to a
# security-relevant surface, so it is NOT made unilaterally here — it is reported for
# an owner ruling. Comparison is left EXCUSED only to keep this entry honest about
# what it hides; do not treat the excuse as a resolution.
signalwire.web.web_service.WebService.security: UNRESOLVED capability gap (reported 2026-07-28, awaiting owner ruling — see the note above): the reference's `security` returns the unified `SecurityConfig` (SSL + CORS + security headers + allowed hosts + basic auth); TS's returns `SslConfig`, an SSL/HSTS-only subset, so the CORS/headers/host/auth capabilities are unreachable through this accessor. TS's own faithful `SecurityConfig` exists (src/SWMLService.ts) but `WebService` does not use it. Not idiom, not a rename, not a language ceiling.

## Port-only typed composition getters + framework-app accessor (signature-side additions)

# The HTTP-framework app accessor: the Python reference exposes the underlying
# FastAPI app; TS builds on Hono, which has no FastAPI analog, so the accessor's
# reference return type (`class:fastapi.FastAPI`) has no TS twin. The equivalent
# TS capability (`getApp()`) is surfaced separately; this bare `app` property/return
# is impossible to match one-for-one because the framework class differs.
signalwire.agent_server.AgentServer.app: impossible: reference `app` returns `class:fastapi.FastAPI`; TS is built on Hono (no FastAPI). The equivalent app-accessor is the TS-idiom `getApp()`; the FastAPI-typed accessor has no TS twin.
signalwire.web.web_service.WebService.app: impossible: reference `app` returns `optional<class:FastAPI>`; TS is built on Hono (no FastAPI). The framework app object has no FastAPI-typed TS counterpart.

# Port-only typed composition getters: TS exposes these composed sub-objects as
# typed `readonly` fields / getters (the static enumerator records each as a
# `(self)→<SDK class>` accessor). Python composes the same state but as a plain
# dynamically-set instance attribute the signatures oracle does not record — so
# each reads "in port, not in reference". Same composed object, stronger TS typing.
signalwire.core.agent_base.AgentBase.log: TS exposes the composed `Logger` as a typed `log` getter; Python sets `self.log`/logger dynamically so the signatures oracle records no such accessor. Same logger object, TS-idiom typed accessor.
signalwire.core.swml_service.SWMLService.log: TS exposes the composed `Logger` as a typed `log` getter; Python sets it dynamically so the signatures oracle records no accessor. Same logger object, TS-idiom typed accessor.
signalwire.core.swml_service.SWMLService.swml_builder: TS exposes the composed `SWMLBuilder` as a typed `swmlBuilder` getter; Python holds the builder as a dynamically-set attribute the signatures oracle does not record. Same builder object, stronger TS typing.
signalwire.core.auth_handler.AuthHandler.config: TS exposes the `AuthConfig` as a typed `config` getter; Python holds the same config as a dynamically-set attribute. Same config object, TS-idiom typed accessor.
signalwire.core.skill_base.SkillBase.config: TS exposes the `SkillConfig` as a typed `config` getter; Python holds the same config as a dynamically-set attribute. Same config object, TS-idiom typed accessor.

# TS resource base constructors: the generated REST resource bases take
# `(http, base_path)` to wire the client + collection path; the Python reference
# base resources are constructed differently (no explicit `__init__` recorded on
# these bases), so the ctor reads "in port, not in reference". Port-idiom wiring.
signalwire.rest._base.CrudResource.__init__: idiom: TS resource base ctor `(http, base_path)` wires the HttpClient + collection path; the Python reference records no `__init__` on this base (resources are constructed via the client tree). Port-idiom construction, no reference twin to compare.
signalwire.rest._base.CrudWithAddresses.__init__: idiom: TS resource base ctor `(http, base_path)` wires the HttpClient + collection path; the Python reference records no `__init__` on this base. Port-idiom construction, no reference twin.
signalwire.rest._base.ReadResource.__init__: idiom: TS resource base ctor `(http, base_path)` wires the HttpClient + collection path; the Python reference records no `__init__` on this base. Port-idiom construction, no reference twin.
signalwire.core.agent.tools.registry.ToolRegistry.define_tool: ts-generic-intersection-options: defineTool<P, R>(opts: Omit<SwaigFunctionOptions,...> & { parameters?: P; required?: R; handler: ... }) — the bag is a GENERIC INTERSECTION whose first arm is a mapped `Omit<...>` type, not a type literal. `optionsBagTypeLiteral` unfolds an intersection only when exactly ONE arm is a literal, so this cannot be exploded structurally. Same tool registered.
signalwire.core.mixins.tool_mixin.ToolMixin.define_tool: ts-generic-intersection-options: same declaration as ToolRegistry.define_tool (both project from SWMLService.defineTool) — a generic intersection over a mapped `Omit<...>`, which the options-object unfold cannot explode. Same tool registered.
signalwire.core.skill_base.SkillBase.define_tool: ts-named-options-type: defineTool(toolDef: SkillToolDefinition) — a NAMED interface collapsing Python's untyped `**kwargs` splat. The reference records zero params (the oracle strips the `**kwargs` tail), so the port's one required typed bag reads as a count mismatch. Tracked with the named-class-type (`stricter/superset`) bucket.
signalwire.core.skill_manager.SkillManager.load_skill: ts-named-options-type: loadSkill(skillClass, config?: SkillConfig) — the skill_name is derived from the class's static SKILL_NAME (not a separate arg) and the params bag is a NAMED interface, so the unfold cannot explode it. Same load contract.
signalwire.core.mixins.skill_mixin.SkillMixin.add_skill: ts-object-arg: addSkill(skill: SkillBase) takes the constructed SkillBase INSTANCE, where the reference takes (skill_name, params) and constructs it internally. Not an options bag at all — a genuine object argument; the add-by-name path is the separate addSkillByName.
signalwire.agent_server.AgentServer.run: ts-flat-params: run(host?: string, port?: number) takes flat optional positionals — not an options object — and omits Python's serverless event/context leading params (those belong to the per-agent serverless entrypoint, not the multi-agent HTTP server). host/port are the same values.
signalwire.core.mixins.web_mixin.WebMixin.run: ts-options-member-order: run(opts) collapses Python's event/context/force_mode/host/port into one options object, but the TS members are declared in a DIFFERENT ORDER (host, port, event, context, platform) than the reference's positional list. The signature differ compares params BY POSITION, so unfolding this bag pairs event<->host and port<->context and manufactures four type mismatches out of correctly-corresponding members. An options object is an unordered keyword bag in TS -- member order carries no caller-visible meaning -- so realigning it would be cosmetic churn in the source to satisfy a positional comparison. Same values, keyword-passed; the serverless return is a typed ServerlessResponse|void where Python is Optional[dict|str] (the precise serialized shape, same JSON).
signalwire.rest._request_options.RequestOptions.merge: ts-init-type-vocabulary: the override param is typed as RequestOptionsInit (the object-literal init of the RequestOptions value class) so a caller passes a plain object; the reference types it as RequestOptions. Same shallow-merge semantics over an identical field set. This is the named-init-type vocabulary question, not an options-object unfold.
signalwire.rest._request_options.resolve: ts-init-type-vocabulary: the client_default/per_request params are typed as RequestOptionsInit (the object-literal init of the RequestOptions value class) vs the reference's RequestOptions; identical fields, identical resolve-over-default semantics.
signalwire.core.function_result.FunctionResult.pay: ts-typed-list-elements: after the options-object unfold, `parameters` and `prompts` compare as list<PaymentParameter>/list<PaymentPrompt> (named element interfaces) against the reference's list<dict<string,string>>/list<dict<string,any>>. The port is STRICTER: the named interfaces enumerate exactly the keys the reference documents for those dicts, and the emitted wire is the same JSON array of objects. Named-class-type vocabulary, tracked with the `stricter/superset` bucket.
signalwire.core.function_result.FunctionResult.join_conference: ts-optional-any-erasure: after the options-object unfold, the `result` member records as bare `any` where the reference records `optional<any>`. The TS declaration IS optional (`result?: unknown`), but `unknown`/`any` absorbs the optionality wrap in the enumerator's canonical type projection, so the `optional<>` shell is not emitted for an any-typed member. Same optional member, same wire.
