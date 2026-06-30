# PORT_ADDITIONS.md

This file enumerates every public symbol in the TypeScript port that has
NO direct Python-reference equivalent.

Each line has the form:

    <fully.qualified.python-style.symbol>: <rationale>

The `diff_port_surface.py` tool treats every listed symbol as an intentional
port-specific extension. Unlisted extras fail the audit.

Most additions below fall into three buckets:
  1. TypeScript-native convenience helpers (getters, predicates, richer types)
  2. SkillManager / SkillRegistry accessors that Python keeps as private fields
  3. Framework-specific glue (Hono middleware, node:https SSL handling)

---

## Skill-specific additions

signalwire.skills.api_ninjas_trivia.skill.ApiNinjasTriviaSkill.get_hints: TS-specific skill helper method or class
signalwire.skills.api_ninjas_trivia.skill.create_skill: TS-specific skill helper method or class
signalwire.skills.ask_claude.skill.AskClaudeSkill: TS-specific skill helper method or class
signalwire.skills.ask_claude.skill.AskClaudeSkill.get_parameter_schema: TS-specific skill helper method or class
signalwire.skills.ask_claude.skill.AskClaudeSkill.get_tools: TS-specific skill helper method or class
signalwire.skills.ask_claude.skill.create_skill: TS-specific skill helper method or class
signalwire.skills.claude_skills.skill.ClaudeSkillsSkill.get_tools: TS-specific skill helper method or class
signalwire.skills.claude_skills.skill.create_skill: TS-specific skill helper method or class
signalwire.skills.custom_skills.skill.CustomSkillsSkill: TS-specific skill helper method or class
signalwire.skills.custom_skills.skill.CustomSkillsSkill.__init__: TS-specific skill helper method or class
signalwire.skills.custom_skills.skill.CustomSkillsSkill.get_compilation_errors: TS-specific skill helper method or class
signalwire.skills.custom_skills.skill.CustomSkillsSkill.get_parameter_schema: TS-specific skill helper method or class
signalwire.skills.custom_skills.skill.CustomSkillsSkill.get_tools: TS-specific skill helper method or class
signalwire.skills.custom_skills.skill.create_skill: TS-specific skill helper method or class
signalwire.skills.datasphere.skill.DataSphereSkill.get_tools: TS-specific skill helper method or class
signalwire.skills.datasphere.skill.create_skill: TS-specific skill helper method or class
signalwire.skills.datasphere_serverless.skill.DataSphereServerlessSkill.get_data_map_tools: TS-specific skill helper method or class
signalwire.skills.datasphere_serverless.skill.DataSphereServerlessSkill.get_tools: TS-specific skill helper method or class
signalwire.skills.datasphere_serverless.skill.create_skill: TS-specific skill helper method or class
signalwire.skills.datetime.skill.DateTimeSkill.get_tools: TS-specific skill helper method or class
signalwire.skills.datetime.skill.create_skill: TS-specific skill helper method or class
signalwire.skills.google_maps.skill.GoogleMapsSkill.get_tools: TS-specific skill helper method or class
signalwire.skills.google_maps.skill.create_skill: TS-specific skill helper method or class
signalwire.skills.info_gatherer.skill.InfoGathererSkill.get_tools: TS-specific skill helper method or class
signalwire.skills.info_gatherer.skill.create_skill: TS-specific skill helper method or class
signalwire.skills.joke.skill.JokeSkill.get_tools: TS-specific skill helper method or class
signalwire.skills.joke.skill.create_skill: TS-specific skill helper method or class
signalwire.skills.math.skill.MathSkill.get_tools: TS-specific skill helper method or class
signalwire.skills.math.skill.create_skill: TS-specific skill helper method or class
signalwire.skills.mcp_gateway.skill.McpGatewaySkill: TS-specific skill helper method or class
signalwire.skills.mcp_gateway.skill.McpGatewaySkill.get_global_data: TS-specific skill helper method or class
signalwire.skills.mcp_gateway.skill.McpGatewaySkill.get_hints: TS-specific skill helper method or class
signalwire.skills.mcp_gateway.skill.McpGatewaySkill.get_parameter_schema: TS-specific skill helper method or class
signalwire.skills.mcp_gateway.skill.McpGatewaySkill.get_tools: TS-specific skill helper method or class
signalwire.skills.mcp_gateway.skill.McpGatewaySkill.setup: TS-specific skill helper method or class
signalwire.skills.mcp_gateway.skill.create_skill: TS-specific skill helper method or class
signalwire.skills.native_vector_search.skill.NativeVectorSearchSkill.get_tools: TS-specific skill helper method or class
signalwire.skills.native_vector_search.skill.create_skill: TS-specific skill helper method or class
signalwire.skills.play_background_file.skill.create_skill: TS-specific skill helper method or class
signalwire.skills.registry.register_builtin_skills: TS-specific skill helper method or class
signalwire.skills.spider.skill.SpiderSkill.get_tools: TS-specific skill helper method or class
signalwire.skills.spider.skill.create_skill: TS-specific skill helper method or class
signalwire.skills.swml_transfer.skill.SwmlTransferSkill: TS-specific skill helper method or class
signalwire.skills.swml_transfer.skill.SwmlTransferSkill.get_hints: TS-specific skill helper method or class
signalwire.skills.swml_transfer.skill.SwmlTransferSkill.get_instance_key: TS-specific skill helper method or class
signalwire.skills.swml_transfer.skill.SwmlTransferSkill.get_parameter_schema: TS-specific skill helper method or class
signalwire.skills.swml_transfer.skill.SwmlTransferSkill.get_tools: TS-specific skill helper method or class
signalwire.skills.swml_transfer.skill.SwmlTransferSkill.setup: TS-specific skill helper method or class
signalwire.skills.swml_transfer.skill.create_skill: TS-specific skill helper method or class
signalwire.skills.weather_api.skill.create_skill: TS-specific skill helper method or class
signalwire.skills.web_search.skill.WebSearchSkill.get_tools: TS-specific skill helper method or class
signalwire.skills.web_search.skill.create_skill: TS-specific skill helper method or class
signalwire.skills.web_search.skill.extract_text_from_html: TS-specific skill helper method or class
signalwire.skills.wikipedia_search.skill.WikipediaSearchSkill.get_tools: TS-specific skill helper method or class
signalwire.skills.wikipedia_search.skill.create_skill: TS-specific skill helper method or class

## Other additions

signalwire.agent_server.AgentServer.get_app: TS port-only helper — functionality has no direct Python equivalent
signalwire.agent_server.AgentServer.rtc_session: TS port-only helper — functionality has no direct Python equivalent
signalwire.core.agent.prompt.manager.PromptManager.add_section: TS port-only helper — functionality has no direct Python equivalent
signalwire.core.agent.prompt.manager.PromptManager.add_subsection: TS port-only helper — functionality has no direct Python equivalent
signalwire.core.agent.prompt.manager.PromptManager.add_to_section: TS port-only helper — functionality has no direct Python equivalent
signalwire.core.agent.prompt.manager.PromptManager.get_pom_builder: TS port-only helper — functionality has no direct Python equivalent
signalwire.core.agent.prompt.manager.PromptManager.has_section: TS port-only helper — functionality has no direct Python equivalent
signalwire.core.agent.tools.type_inference.parse_function_params: TS port-only helper — functionality has no direct Python equivalent
signalwire.core.data_map.get_allowed_env_prefixes: TS port-only helper — functionality has no direct Python equivalent
signalwire.core.data_map.set_allowed_env_prefixes: TS port-only helper — functionality has no direct Python equivalent
signalwire.core.mixins.serverless_mixin.ServerlessAdapter: TS port-only helper — functionality has no direct Python equivalent
signalwire.core.mixins.serverless_mixin.ServerlessAdapter.__init__: TS port-only helper — functionality has no direct Python equivalent
signalwire.core.mixins.serverless_mixin.ServerlessAdapter.create_azure_handler: TS port-only helper — functionality has no direct Python equivalent
signalwire.core.mixins.serverless_mixin.ServerlessAdapter.create_gcf_handler: TS port-only helper — functionality has no direct Python equivalent
signalwire.core.mixins.serverless_mixin.ServerlessAdapter.create_lambda_handler: TS port-only helper — functionality has no direct Python equivalent
signalwire.core.mixins.serverless_mixin.ServerlessAdapter.detect_platform: TS port-only helper — functionality has no direct Python equivalent
signalwire.core.mixins.serverless_mixin.ServerlessAdapter.generate_url: TS port-only helper — functionality has no direct Python equivalent
signalwire.core.mixins.serverless_mixin.ServerlessAdapter.get_platform: TS port-only helper — functionality has no direct Python equivalent
signalwire.core.mixins.serverless_mixin.ServerlessAdapter.handle_request: TS port-only helper — functionality has no direct Python equivalent
signalwire.core.swaig_function.is_full_parameter_schema: TS port-only helper — discriminates a full JSON Schema from a bare properties map; Python inlines the sniff and has no exported helper
signalwire.core.swaig_function.normalize_parameters: TS port-only helper — unifies the parameters-shape normalization (full schema vs bare map) that was reimplemented in 3 places; no Python counterpart
signalwire.prefabs.concierge.ConciergeAgent.define_tools: TS port-only helper — functionality has no direct Python equivalent
signalwire.prefabs.concierge.create_concierge_agent: TS port-only helper — functionality has no direct Python equivalent
signalwire.prefabs.faq_bot.FAQBotAgent.define_tools: TS port-only helper — functionality has no direct Python equivalent
signalwire.prefabs.faq_bot.create_faq_bot_agent: TS port-only helper — functionality has no direct Python equivalent
signalwire.prefabs.info_gatherer.InfoGathererAgent.define_tools: TS port-only helper — functionality has no direct Python equivalent
signalwire.prefabs.info_gatherer.create_info_gatherer_agent: TS port-only helper — functionality has no direct Python equivalent
signalwire.prefabs.receptionist.ReceptionistAgent.define_tools: TS port-only helper — functionality has no direct Python equivalent
signalwire.prefabs.receptionist.create_receptionist_agent: TS port-only helper — functionality has no direct Python equivalent
signalwire.prefabs.survey.SurveyAgent.define_tools: TS port-only helper — functionality has no direct Python equivalent
signalwire.prefabs.survey.create_survey_agent: TS port-only helper — functionality has no direct Python equivalent
signalwire.rest._pagination.paginate: TS port-only helper — functionality has no direct Python equivalent
signalwire.rest._pagination.paginate_all: TS port-only helper — functionality has no direct Python equivalent
signalwire.utils.is_private_ip: TS port-only helper — functionality has no direct Python equivalent
signalwire.utils.resolve_and_validate_url: TS port-only helper — functionality has no direct Python equivalent
signalwire.utils.safe_assign: TS port-only helper — functionality has no direct Python equivalent
signalwire.utils.validate_url: TS port-only helper — functionality has no direct Python equivalent
signalwire.web.web_service.WebService.get_app: TS port-only helper — functionality has no direct Python equivalent
signalwire.web.web_service.WebService.ssl_config: TS port-only helper — functionality has no direct Python equivalent

## ParameterSchema — typed SWAIG tool-parameter builder (Tier-2 flagship, explicit-params path)

`ParameterSchema` / `paramSchema()` (`src/ParameterSchema.ts`) is the typed,
fluent builder for a SWAIG tool's `parameters` JSON-Schema object — the
idiomatic replacement for the untyped `Record<string, unknown>` blob accepted
by `defineTool({ parameters })` / `defineTypedTool({ parameters })`. Python's
`define_tool(parameters=...)` takes a bare `Dict[str, Any]`, so there is no
reference symbol; this is a pure TS-idiom addition. The builder's `build()`
output is **byte-identical** to the equivalent hand-written object (TypeScript
erases types → identical wire bytes), so drift stays 0 and emission is
unchanged — it is autocomplete/typo/closed-set ergonomics only. The convenience
methods (`record_format`/`record_direction`/`tap_direction`/`codec`) bake the
strongly-grounded Tier-1 closed sets in as `enum:[...]` properties (the
SkillName idiom, now on the tool-parameter side). See IDIOM_PASS_JOURNAL.md §2
/ §4 "Tier 2 flagship". (`RECORD_FORMATS`/`RECORD_DIRECTIONS`/`TAP_DIRECTIONS`/
`TAP_CODECS` value arrays + the `RecordFormat`/`…` literal types are also
exported but are bare const/type exports, not enumerated symbols.)

signalwire.parameter_schema.ParameterSchema: typed SWAIG tool-parameter builder — no Python equivalent (Python takes a bare dict)
signalwire.parameter_schema.ParameterSchema.property: typed param-schema builder method — no Python equivalent
signalwire.parameter_schema.ParameterSchema.string: typed param-schema builder method — no Python equivalent
signalwire.parameter_schema.ParameterSchema.integer: typed param-schema builder method — no Python equivalent
signalwire.parameter_schema.ParameterSchema.number: typed param-schema builder method — no Python equivalent
signalwire.parameter_schema.ParameterSchema.boolean: typed param-schema builder method — no Python equivalent
signalwire.parameter_schema.ParameterSchema.array: typed param-schema builder method — no Python equivalent
signalwire.parameter_schema.ParameterSchema.enum: typed param-schema builder method (closed-set → enum:[...]) — no Python equivalent
signalwire.parameter_schema.ParameterSchema.record_format: Tier-1 closed-set convenience (enum:['wav','mp3','mp4']) — no Python equivalent
signalwire.parameter_schema.ParameterSchema.record_direction: Tier-1 closed-set convenience (enum:['speak','listen','both']) — no Python equivalent
signalwire.parameter_schema.ParameterSchema.tap_direction: Tier-1 closed-set convenience (enum:['speak','hear','both']) — no Python equivalent
signalwire.parameter_schema.ParameterSchema.codec: Tier-1 closed-set convenience (enum:['PCMU','PCMA']) — no Python equivalent
signalwire.parameter_schema.ParameterSchema.required: typed param-schema builder method — no Python equivalent
signalwire.parameter_schema.ParameterSchema.build: materialise the JSON-Schema object (byte-identical to the untyped blob) — no Python equivalent
signalwire.parameter_schema.param_schema: factory for ParameterSchema — no Python equivalent

## AgentBase port-specific additions

signalwire.core.agent_base.AgentBase.add_skill_by_name: TS-native AgentBase accessor / utility — aggregates state that is a private attribute or cross-mixin helper in Python
signalwire.core.agent_base.AgentBase.define_typed_tool: TS-native AgentBase accessor / utility — aggregates state that is a private attribute or cross-mixin helper in Python
signalwire.core.agent_base.AgentBase.extract_sip_username: TS-native AgentBase accessor / utility — aggregates state that is a private attribute or cross-mixin helper in Python
signalwire.core.agent_base.AgentBase.get_mcp_servers: TS-native AgentBase accessor / utility — aggregates state that is a private attribute or cross-mixin helper in Python
signalwire.core.agent_base.AgentBase.get_prompt_pom: TS-native AgentBase accessor / utility — aggregates state that is a private attribute or cross-mixin helper in Python
signalwire.core.agent_base.AgentBase.get_registered_tools: TS-native AgentBase accessor / utility — aggregates state that is a private attribute or cross-mixin helper in Python
signalwire.core.agent_base.AgentBase.get_tool: TS-native AgentBase accessor / utility — aggregates state that is a private attribute or cross-mixin helper in Python
signalwire.core.agent_base.AgentBase.get_tools: TS-native AgentBase accessor / utility — aggregates state that is a private attribute or cross-mixin helper in Python
signalwire.core.agent_base.AgentBase.on_error: TS-native agent-level SWAIG error hook (#19371) — Python has no programmatic error surface on tool dispatch; registers a callback invoked when a tool handler throws, for reporting + optional response control
signalwire.core.agent_base.AgentBase.ensure_tools_defined: TS-native idempotent guard (#19370) — auto-invokes defineTools() once so a forgotten explicit call no longer yields a tool-less agent; Python has no separate define-tools lifecycle hook
signalwire.core.agent_base.AgentBase.replace_global_data: TS-native true-replace path (#19376) — Python's set_global_data only merges (.update()); this clears all prior keys (incl. skill-contributed) and sets a fresh global_data, the unambiguous counterpart to the merging setGlobalData/updateGlobalData
signalwire.core.agent_base.AgentBase.handle_mcp_request: TS-native AgentBase accessor / utility — aggregates state that is a private attribute or cross-mixin helper in Python
signalwire.core.agent_base.AgentBase.is_mcp_server_enabled: TS-native AgentBase accessor / utility — aggregates state that is a private attribute or cross-mixin helper in Python
signalwire.core.agent_base.AgentBase.native_functions: TS-native AgentBase accessor / utility — aggregates state that is a private attribute or cross-mixin helper in Python
signalwire.core.agent_base.AgentBase.prompt_manager: TS-native AgentBase accessor / utility — aggregates state that is a private attribute or cross-mixin helper in Python
signalwire.core.agent_base.AgentBase.remove_skill_by_name: TS-native AgentBase accessor / utility — aggregates state that is a private attribute or cross-mixin helper in Python
signalwire.core.agent_base.AgentBase.render_swml: TS-native AgentBase accessor / utility — aggregates state that is a private attribute or cross-mixin helper in Python
signalwire.core.agent_base.AgentBase.run_serverless: TS-native AgentBase accessor / utility — aggregates state that is a private attribute or cross-mixin helper in Python
signalwire.core.agent_base.AgentBase.skill_manager: TS-native AgentBase accessor / utility — aggregates state that is a private attribute or cross-mixin helper in Python

## LiveWire port-specific

signalwire.livewire.AgentServer.get_agent: LiveKit-compat helper exposed by the TS LiveWire shim (extra compatibility surface for @livekit/agents callers)
signalwire.livewire.AgentServer.get_agents: LiveKit-compat helper exposed by the TS LiveWire shim (extra compatibility surface for @livekit/agents callers)
signalwire.livewire.AgentServer.register: LiveKit-compat helper exposed by the TS LiveWire shim (extra compatibility surface for @livekit/agents callers)
signalwire.livewire.AgentServer.register_global_routing_callback: LiveKit-compat helper exposed by the TS LiveWire shim (extra compatibility surface for @livekit/agents callers)
signalwire.livewire.AgentServer.register_sip_username: LiveKit-compat helper exposed by the TS LiveWire shim (extra compatibility surface for @livekit/agents callers)
signalwire.livewire.AgentServer.run: LiveKit-compat helper exposed by the TS LiveWire shim (extra compatibility surface for @livekit/agents callers)
signalwire.livewire.AgentServer.serve_static_files: LiveKit-compat helper exposed by the TS LiveWire shim (extra compatibility surface for @livekit/agents callers)
signalwire.livewire.AgentServer.setup_sip_routing: LiveKit-compat helper exposed by the TS LiveWire shim (extra compatibility surface for @livekit/agents callers)
signalwire.livewire.AgentServer.unregister: LiveKit-compat helper exposed by the TS LiveWire shim (extra compatibility surface for @livekit/agents callers)
signalwire.livewire.AgentSession.get_sw_agent: LiveKit-compat helper exposed by the TS LiveWire shim (extra compatibility surface for @livekit/agents callers)
signalwire.livewire.ServerOptions: LiveKit-compat helper exposed by the TS LiveWire shim (extra compatibility surface for @livekit/agents callers)
signalwire.livewire.ServerOptions.__init__: LiveKit-compat helper exposed by the TS LiveWire shim (extra compatibility surface for @livekit/agents callers)
signalwire.livewire.WorkerOptions: LiveKit-compat helper exposed by the TS LiveWire shim (extra compatibility surface for @livekit/agents callers)
signalwire.livewire.WorkerOptions.__init__: LiveKit-compat helper exposed by the TS LiveWire shim (extra compatibility surface for @livekit/agents callers)
signalwire.livewire.define_agent: LiveKit-compat helper exposed by the TS LiveWire shim (extra compatibility surface for @livekit/agents callers)
signalwire.livewire.handoff: LiveKit-compat helper exposed by the TS LiveWire shim (extra compatibility surface for @livekit/agents callers)

## Logger (TS-native logging helpers)

signalwire.core.logging_config.Logger: TS Logger module exposes stream / color / level setters that are function-local configuration in Python
signalwire.core.logging_config.Logger.__init__: TS Logger module exposes stream / color / level setters that are function-local configuration in Python
signalwire.core.logging_config.Logger.bind: TS Logger module exposes stream / color / level setters that are function-local configuration in Python
signalwire.core.logging_config.Logger.debug: TS Logger module exposes stream / color / level setters that are function-local configuration in Python
signalwire.core.logging_config.Logger.error: TS Logger module exposes stream / color / level setters that are function-local configuration in Python
signalwire.core.logging_config.Logger.info: TS Logger module exposes stream / color / level setters that are function-local configuration in Python
signalwire.core.logging_config.Logger.warn: TS Logger module exposes stream / color / level setters that are function-local configuration in Python
signalwire.core.logging_config.set_global_log_color: TS Logger module exposes stream / color / level setters that are function-local configuration in Python
signalwire.core.logging_config.set_global_log_format: TS Logger module exposes stream / color / level setters that are function-local configuration in Python
signalwire.core.logging_config.set_global_log_level: TS Logger module exposes stream / color / level setters that are function-local configuration in Python
signalwire.core.logging_config.set_global_log_stream: TS Logger module exposes stream / color / level setters that are function-local configuration in Python
signalwire.core.logging_config.suppress_all_logs: TS Logger module exposes stream / color / level setters that are function-local configuration in Python

## SkillManager port-specific additions

signalwire.core.skill_manager.SkillManager.clear: TS-native SkillManager API — Python keeps most of this state as private; TS exposes richer accessors
signalwire.core.skill_manager.SkillManager.get_all_hints: TS-native SkillManager API — Python keeps most of this state as private; TS exposes richer accessors
signalwire.core.skill_manager.SkillManager.get_all_prompt_sections: TS-native SkillManager API — Python keeps most of this state as private; TS exposes richer accessors
signalwire.core.skill_manager.SkillManager.get_all_tools: TS-native SkillManager API — Python keeps most of this state as private; TS exposes richer accessors
signalwire.core.skill_manager.SkillManager.get_loaded_skill_entries: TS-native SkillManager API — Python keeps most of this state as private; TS exposes richer accessors
signalwire.core.skill_manager.SkillManager.get_merged_global_data: TS-native SkillManager API — Python keeps most of this state as private; TS exposes richer accessors
signalwire.core.skill_manager.SkillManager.has_skill_by_key: TS-native SkillManager API — Python keeps most of this state as private; TS exposes richer accessors
signalwire.core.skill_manager.SkillManager.list_skill_keys: TS-native SkillManager API — Python keeps most of this state as private; TS exposes richer accessors
signalwire.core.skill_manager.SkillManager.load_skill_by_name: TS-native SkillManager API — Python keeps most of this state as private; TS exposes richer accessors
signalwire.core.skill_manager.SkillManager.loaded_skills: TS-native SkillManager API — Python keeps most of this state as private; TS exposes richer accessors
signalwire.core.skill_manager.SkillManager.remove_skill_by_name: TS-native SkillManager API — Python keeps most of this state as private; TS exposes richer accessors
signalwire.core.skill_manager.SkillManager.size: TS-native SkillManager API — Python keeps most of this state as private; TS exposes richer accessors

## SkillRegistry port-specific additions

signalwire.skills.registry.SkillRegistry.clear: TS-native singleton-style SkillRegistry API (singleton lifecycle, lock / unregister / has, etc.)
signalwire.skills.registry.SkillRegistry.create: TS-native singleton-style SkillRegistry API (singleton lifecycle, lock / unregister / has, etc.)
signalwire.skills.registry.SkillRegistry.discover_all: TS-native singleton-style SkillRegistry API (singleton lifecycle, lock / unregister / has, etc.)
signalwire.skills.registry.SkillRegistry.get_instance: TS-native singleton-style SkillRegistry API (singleton lifecycle, lock / unregister / has, etc.)
signalwire.skills.registry.SkillRegistry.get_search_paths: TS-native singleton-style SkillRegistry API (singleton lifecycle, lock / unregister / has, etc.)
signalwire.skills.registry.SkillRegistry.get_skill_schema: TS-native singleton-style SkillRegistry API (singleton lifecycle, lock / unregister / has, etc.)
signalwire.skills.registry.SkillRegistry.has: TS-native singleton-style SkillRegistry API (singleton lifecycle, lock / unregister / has, etc.)
signalwire.skills.registry.SkillRegistry.list_registered: TS-native singleton-style SkillRegistry API (singleton lifecycle, lock / unregister / has, etc.)
signalwire.skills.registry.SkillRegistry.lock: TS-native singleton-style SkillRegistry API (singleton lifecycle, lock / unregister / has, etc.)
signalwire.skills.registry.SkillRegistry.reset_instance: TS-native singleton-style SkillRegistry API (singleton lifecycle, lock / unregister / has, etc.)
signalwire.skills.registry.SkillRegistry.size: TS-native singleton-style SkillRegistry API (singleton lifecycle, lock / unregister / has, etc.)
signalwire.skills.registry.SkillRegistry.unregister: TS-native singleton-style SkillRegistry API (singleton lifecycle, lock / unregister / has, etc.)

## Contexts port-specific

signalwire.core.contexts.Context.get_initial_step: TS ContextBuilder / Context helper with additional navigation / builder methods
signalwire.core.contexts.Context.get_step_order: TS ContextBuilder / Context helper with additional navigation / builder methods
signalwire.core.contexts.Context.get_steps: TS ContextBuilder / Context helper with additional navigation / builder methods
signalwire.core.contexts.Context.get_valid_contexts: TS ContextBuilder / Context helper with additional navigation / builder methods
signalwire.core.contexts.Context.to_json: TS-native toJSON() serialization hook (delegates to to_dict) so JSON.stringify emits the wire shape; no Python counterpart
signalwire.core.contexts.ContextBuilder.attach_agent: TS ContextBuilder / Context helper with additional navigation / builder methods
signalwire.core.contexts.ContextBuilder.to_json: TS-native toJSON() serialization hook (delegates to to_dict) so JSON.stringify emits the wire shape; no Python counterpart
signalwire.core.contexts.GatherInfo.get_completion_action: TS ContextBuilder / Context helper with additional navigation / builder methods
signalwire.core.contexts.GatherInfo.get_questions: TS ContextBuilder / Context helper with additional navigation / builder methods
signalwire.core.contexts.GatherInfo.to_json: TS-native toJSON() serialization hook (delegates to to_dict) so JSON.stringify emits the wire shape; no Python counterpart
signalwire.core.contexts.GatherQuestion.to_json: TS-native toJSON() serialization hook (delegates to to_dict) so JSON.stringify emits the wire shape; no Python counterpart
signalwire.core.contexts.Step.get_gather_info: TS ContextBuilder / Context helper with additional navigation / builder methods
signalwire.core.contexts.Step.get_step_valid_contexts: TS ContextBuilder / Context helper with additional navigation / builder methods
signalwire.core.contexts.Step.get_valid_steps: TS ContextBuilder / Context helper with additional navigation / builder methods
signalwire.core.contexts.Step.to_json: TS-native toJSON() serialization hook (delegates to to_dict) so JSON.stringify emits the wire shape; no Python counterpart

## SkillBase port-specific additions

signalwire.core.skill_base.define_skill_tool: TS-idiom module-level helper — the getTools()-level counterpart to SWMLService.defineTool's schema→handler-args inference. Wrapping a tool entry in defineSkillTool({parameters, required, handler}) infers the handler's `args` from the schema (required prop → typed+present, enum → literal union, optional → `| undefined`; a loose Record degrades to open args). No Python equivalent (Python skills hand-write loose Dict[str, Any] tool dicts). Author-side typing only; wire emission byte-identical, drift/emission unchanged.
signalwire.core.skill_base.SkillBase.get_agent: TS-native SkillBase helper or getter — property / helper method that Python exposes via direct attribute access
signalwire.core.skill_base.SkillBase.get_config: TS-native SkillBase helper or getter — property / helper method that Python exposes via direct attribute access
signalwire.core.skill_base.SkillBase.get_data_map_tools: TS-native SkillBase helper or getter — property / helper method that Python exposes via direct attribute access
signalwire.core.skill_base.SkillBase.get_skill_namespace: TS-native SkillBase helper or getter — property / helper method that Python exposes via direct attribute access
signalwire.core.skill_base.SkillBase.get_tools: TS-native SkillBase helper or getter — property / helper method that Python exposes via direct attribute access
signalwire.core.skill_base.SkillBase.has_all_env_vars: TS-native SkillBase helper or getter — property / helper method that Python exposes via direct attribute access
signalwire.core.skill_base.SkillBase.has_all_packages: TS-native SkillBase helper or getter — property / helper method that Python exposes via direct attribute access
signalwire.core.skill_base.SkillBase.is_initialized: TS-native SkillBase helper or getter — property / helper method that Python exposes via direct attribute access
signalwire.core.skill_base.SkillBase.mark_initialized: TS-native SkillBase helper or getter — property / helper method that Python exposes via direct attribute access
signalwire.core.skill_base.SkillBase.set_agent: TS-native SkillBase helper or getter — property / helper method that Python exposes via direct attribute access

## ConfigLoader port-specific

signalwire.core.config_loader.ConfigLoader.config_paths: TS ConfigLoader has richer accessor helpers (type-narrowed getters, has/set helpers)
signalwire.core.config_loader.ConfigLoader.has: TS ConfigLoader has richer accessor helpers (type-narrowed getters, has/set helpers)
signalwire.core.config_loader.ConfigLoader.interpolate_env_vars: TS ConfigLoader has richer accessor helpers (type-narrowed getters, has/set helpers)
signalwire.core.config_loader.ConfigLoader.load: TS ConfigLoader has richer accessor helpers (type-narrowed getters, has/set helpers)
signalwire.core.config_loader.ConfigLoader.load_from_object: TS ConfigLoader has richer accessor helpers (type-narrowed getters, has/set helpers)
signalwire.core.config_loader.ConfigLoader.search: TS ConfigLoader has richer accessor helpers (type-narrowed getters, has/set helpers)
signalwire.core.config_loader.ConfigLoader.set: TS ConfigLoader has richer accessor helpers (type-narrowed getters, has/set helpers)

## POM port-specific

signalwire.core.pom_builder.PomBuilder.add_pom_as_subsection: TS POM helper on PomBuilder / PomSection — richer accessors and navigation helpers than the Python equivalent
signalwire.core.pom_builder.PomBuilder.find_section: TS POM helper on PomBuilder / PomSection — richer accessors and navigation helpers than the Python equivalent
signalwire.core.pom_builder.PomBuilder.reset: TS POM helper on PomBuilder / PomSection — richer accessors and navigation helpers than the Python equivalent
signalwire.core.pom_builder.PomSection: TS POM helper on PomBuilder / PomSection — richer accessors and navigation helpers than the Python equivalent
signalwire.core.pom_builder.PomSection.__init__: TS POM helper on PomBuilder / PomSection — richer accessors and navigation helpers than the Python equivalent
signalwire.core.pom_builder.PomSection.add_subsection: TS POM helper on PomBuilder / PomSection — richer accessors and navigation helpers than the Python equivalent
signalwire.core.pom_builder.PomSection.render_markdown: TS POM helper on PomBuilder / PomSection — richer accessors and navigation helpers than the Python equivalent
signalwire.core.pom_builder.PomSection.render_xml: TS POM helper on PomBuilder / PomSection — richer accessors and navigation helpers than the Python equivalent
signalwire.core.pom_builder.PomSection.to_dict: TS POM helper on PomBuilder / PomSection — richer accessors and navigation helpers than the Python equivalent
signalwire.core.pom_builder.PomSection.to_json: TS-native toJSON() serialization hook (delegates to to_dict) so JSON.stringify emits the wire shape; no Python counterpart
signalwire.pom.pom.Section.to_json: TS-native toJSON() serialization hook (delegates to to_dict) so JSON.stringify emits the wire shape; no Python counterpart

## FunctionResult port-specific

signalwire.core.function_result.FunctionResult.to_json: TS-native toJSON() serialization hook (delegates to to_dict) so JSON.stringify emits the wire shape; no Python counterpart

## Relay port-specific

signalwire.relay.call.Call.pass: TS Relay helper or utility (closures, typed events) that Python covers via async iterators / callables
signalwire.relay.call.Call.to_string: TS Relay helper or utility (closures, typed events) that Python covers via async iterators / callables
signalwire.relay.deferred.create_deferred: TS Relay helper or utility (closures, typed events) that Python covers via async iterators / callables
signalwire.relay.deferred.with_timeout: TS Relay helper or utility (closures, typed events) that Python covers via async iterators / callables
signalwire.relay.message.Message.to_string: TS Relay helper or utility (closures, typed events) that Python covers via async iterators / callables
signalwire.relay.normalize.normalize_device: TS Relay helper or utility (closures, typed events) that Python covers via async iterators / callables
signalwire.relay.normalize.normalize_device_plan: TS Relay helper or utility (closures, typed events) that Python covers via async iterators / callables
signalwire.relay.normalize.normalize_play_item: TS Relay helper or utility (closures, typed events) that Python covers via async iterators / callables
signalwire.relay.normalize.normalize_play_items: TS Relay helper or utility (closures, typed events) that Python covers via async iterators / callables

## Relay typed lifecycle-state predicates (Tier-3 typed objects)

# The three RELAY lifecycle vocabularies (CallState / DialState / MessageState)
# are typed as string-literal unions accepted ALONGSIDE the bare string in
# closedSets.ts (CallState | (string & {}) — same idiom as TtsGender/FaxTone,
# which stay drift-neutral by collapsing to `string` in the enumerator). The
# unions add no new symbols; these terminal-state PREDICATES do. Each is a
# TS-native convenience grounded in the reference's own terminal-set
# definitions: the Python reference checks terminality inline (e.g.
# message.py's `MESSAGE_TERMINAL_STATES` membership, call.py's
# `call_state == CALL_STATE_ENDED`) rather than exposing a named predicate, so
# these are additive — the wire/runtime behavior is identical, they just give
# one well-named home for "is this state final?".
signalwire.relay.closed_sets.is_call_state_terminal: TS-native predicate — true iff a call state is terminal (`ended`); the reference compares `call_state == CALL_STATE_ENDED` inline. Grounded in relay/constants CALL_STATE_* (mirrors signalwire/relay/constants.py).
signalwire.relay.closed_sets.is_dial_state_terminal: TS-native predicate — true iff an outbound-dial state is terminal (`answered`/`failed`); the reference branches on `dial_state` inline in client.py. Grounded in signalwire/relay/client.py (dialing|answered|failed).
signalwire.relay.closed_sets.is_message_state_terminal: TS-native predicate — true iff a message state is terminal (`delivered`/`undelivered`/`failed`); mirrors the reference's `MESSAGE_TERMINAL_STATES` membership test (message.py). Grounded in relay/constants MESSAGE_TERMINAL_STATES.
signalwire.relay.call.Call.is_terminal: TS-native getter — `isCallStateTerminal(this.state)`; idiomatic shortcut for the reference's inline `call.state == 'ended'` check, so the terminal-set definition lives in one place. Additive (Python exposes no Call.is_terminal / Call.is_done).
signalwire.relay.message.Message.is_terminal: TS-native getter testing the message STATE value (`delivered`/`undelivered`/`failed`) — distinct from the reference's `Message.is_done`, which reflects the internal completion-promise settled-ness; `isTerminal` is meaningful even on a freshly-constructed inbound message. Additive.

## SslConfig (SSL-specific config class, TS port-only)

signalwire.core.security_config.SslConfig: TS splits SSL configuration into a dedicated SslConfig class (Python keeps it inside SecurityConfig); the SslConfig methods are all port-specific SSL helpers
signalwire.core.security_config.SslConfig.__init__: TS splits SSL configuration into a dedicated SslConfig class (Python keeps it inside SecurityConfig); the SslConfig methods are all port-specific SSL helpers
signalwire.core.security_config.SslConfig.get_cert: TS splits SSL configuration into a dedicated SslConfig class (Python keeps it inside SecurityConfig); the SslConfig methods are all port-specific SSL helpers
signalwire.core.security_config.SslConfig.get_hsts_header: TS splits SSL configuration into a dedicated SslConfig class (Python keeps it inside SecurityConfig); the SslConfig methods are all port-specific SSL helpers
signalwire.core.security_config.SslConfig.get_key: TS splits SSL configuration into a dedicated SslConfig class (Python keeps it inside SecurityConfig); the SslConfig methods are all port-specific SSL helpers
signalwire.core.security_config.SslConfig.get_server_options: TS splits SSL configuration into a dedicated SslConfig class (Python keeps it inside SecurityConfig); the SslConfig methods are all port-specific SSL helpers
signalwire.core.security_config.SslConfig.hsts_middleware: TS splits SSL configuration into a dedicated SslConfig class (Python keeps it inside SecurityConfig); the SslConfig methods are all port-specific SSL helpers
signalwire.core.security_config.SslConfig.is_configured: TS splits SSL configuration into a dedicated SslConfig class (Python keeps it inside SecurityConfig); the SslConfig methods are all port-specific SSL helpers

## SWMLBuilder port-specific additions

signalwire.core.swml_builder.SWMLBuilder.add_verb: TS SwmlBuilder helper method — additional convenience on top of the canonical addVerb() API
signalwire.core.swml_builder.SWMLBuilder.add_verb_to_section: TS SwmlBuilder helper method — additional convenience on top of the canonical addVerb() API
signalwire.core.swml_builder.SWMLBuilder.document: TS SwmlBuilder helper method — additional convenience on top of the canonical addVerb() API
signalwire.core.swml_builder.SWMLBuilder.get_schema_utils: TS SwmlBuilder helper method — additional convenience on top of the canonical addVerb() API
signalwire.core.swml_builder.SWMLBuilder.set_validation: TS SwmlBuilder helper method — additional convenience on top of the canonical addVerb() API

## AuthHandler port-specific

signalwire.core.auth_handler.AuthHandler.express_middleware: TS AuthHandler exposes Hono-middleware-friendly helpers that Python handles via Flask / FastAPI integrations
signalwire.core.auth_handler.AuthHandler.has_api_key_auth: TS AuthHandler exposes Hono-middleware-friendly helpers that Python handles via Flask / FastAPI integrations
signalwire.core.auth_handler.AuthHandler.has_basic_auth: TS AuthHandler exposes Hono-middleware-friendly helpers that Python handles via Flask / FastAPI integrations
signalwire.core.auth_handler.AuthHandler.has_bearer_auth: TS AuthHandler exposes Hono-middleware-friendly helpers that Python handles via Flask / FastAPI integrations
signalwire.core.auth_handler.AuthHandler.middleware: TS AuthHandler exposes Hono-middleware-friendly helpers that Python handles via Flask / FastAPI integrations
signalwire.core.auth_handler.AuthHandler.validate: TS AuthHandler exposes Hono-middleware-friendly helpers that Python handles via Flask / FastAPI integrations

## SchemaUtils port-specific

signalwire.utils.schema_utils.SchemaUtils.clear_cache: TS SchemaUtils helper built on top of Ajv; exposes predicate / accessor methods that Python does inline
signalwire.utils.schema_utils.SchemaUtils.get_cache_size: TS SchemaUtils helper built on top of Ajv; exposes predicate / accessor methods that Python does inline
signalwire.utils.schema_utils.SchemaUtils.get_verb_description: TS SchemaUtils helper built on top of Ajv; exposes predicate / accessor methods that Python does inline
signalwire.utils.schema_utils.SchemaUtils.get_verb_names: TS SchemaUtils helper built on top of Ajv; exposes predicate / accessor methods that Python does inline
signalwire.utils.schema_utils.SchemaUtils.has_verb: TS SchemaUtils helper built on top of Ajv; exposes predicate / accessor methods that Python does inline
signalwire.utils.schema_utils.SchemaUtils.validate: TS SchemaUtils helper built on top of Ajv; exposes predicate / accessor methods that Python does inline

## SWMLService port-specific

signalwire.core.swml_service.SWMLService.get_app: TS SWMLService exposes richer handler-registration / config getters
signalwire.core.swml_service.SWMLService.get_builder: TS SWMLService exposes richer handler-registration / config getters
signalwire.core.swml_service.SWMLService.render_swml: TS SWMLService exposes richer handler-registration / config getters
signalwire.core.swml_service.SWMLService.set_on_request_callback: TS SWMLService exposes richer handler-registration / config getters
signalwire.core.swml_service.SWMLService.define_tool: TS SWMLService directly exposes the SWAIG tool registry on the base class — Python folds these into AgentBase via the ToolMixin
signalwire.core.swml_service.SWMLService.get_registered_tools: TS SWMLService directly exposes the SWAIG tool registry on the base class — Python folds these into AgentBase via the ToolMixin
signalwire.core.swml_service.SWMLService.get_tool: TS SWMLService directly exposes the SWAIG tool registry on the base class — Python folds these into AgentBase via the ToolMixin
signalwire.core.swml_service.SWMLService.has_tool: TS SWMLService directly exposes the SWAIG tool registry on the base class — Python folds these into AgentBase via the ToolMixin
signalwire.core.swml_service.SWMLService.list_tool_names: TS SWMLService directly exposes the SWAIG tool registry on the base class — Python folds these into AgentBase via the ToolMixin
signalwire.core.swml_service.SWMLService.on_function_call: TS SWMLService directly exposes the SWAIG tool registry on the base class — Python folds these into AgentBase via the ToolMixin
signalwire.core.swml_service.SWMLService.register_additional_routes: TS SWMLService extension hook subclasses override to mount agent-specific routes (post_prompt, debug_events, etc) onto the inherited Hono app
signalwire.core.swml_service.SWMLService.register_swaig_function: TS SWMLService directly exposes the SWAIG tool registry on the base class — Python folds these into AgentBase via the ToolMixin
signalwire.core.swml_service.SWMLService.swaig_pre_dispatch: TS SWMLService extension hook — AgentBase overrides to validate session tokens and apply dynamic-config callbacks before dispatching SWAIG calls

## REST namespace additions

signalwire.rest.namespaces.fabric.AutoMaterializedWebhookResource: TS REST namespace exposes an additional helper or utility method on top of the Python surface
signalwire.rest.namespaces.fabric.AutoMaterializedWebhookResource.__init__: TS REST namespace exposes an additional helper or utility method on top of the Python surface
signalwire.rest.namespaces.fabric.AutoMaterializedWebhookResource.create: TS REST namespace exposes an additional helper or utility method on top of the Python surface
signalwire.rest.namespaces.phone_numbers.PhoneNumbersResource.create: TS REST namespace exposes an additional helper or utility method on top of the Python surface
signalwire.rest.namespaces.phone_numbers.PhoneNumbersResource.update: TS REST namespace exposes an additional helper or utility method on top of the Python surface

## CLI port-specific

signalwire.cli.core.agent_loader.list_agents: TS CLI helper exposed by the TS swaig-test wrapper
signalwire.cli.core.agent_loader.load_agent: TS CLI helper exposed by the TS swaig-test wrapper
signalwire.cli.simulation.mock_env.generate_fake_post_data: TS CLI helper exposed by the TS swaig-test wrapper
signalwire.cli.simulation.mock_env.generate_minimal_post_data: TS CLI helper exposed by the TS swaig-test wrapper

## DataMap port-specific

signalwire.core.data_map.DataMap.enable_env_expansion: TS DataMap helper / accessor
signalwire.core.data_map.DataMap.register_with_agent: TS DataMap helper / accessor
signalwire.core.data_map.DataMap.set_allowed_env_prefixes: TS DataMap helper / accessor

## SessionManager port-specific

signalwire.core.security.session_manager.SessionManager.cleanup: TS SessionManager helper — richer accessor for session storage and debug tokens
signalwire.core.security.session_manager.SessionManager.delete_session_metadata: TS SessionManager helper — richer accessor for session storage and debug tokens

## RestError port-specific

signalwire.rest._base.RestError: TS RestError helper or status accessor
signalwire.rest._base.RestError.__init__: TS RestError helper or status accessor

## RelayClient port-specific (audit-harness support)

signalwire.relay.client.RelayClient.notify: TS-only fire-and-forget JSON-RPC send used by the porting-sdk audit harness to emit a method-bearing `signalwire.event` echo frame the audit fixture watches for; production users prefer `execute()` to keep the response code check
signalwire.relay.client.RelayClient.on_event: TS-only low-level event observer that fires before typed `onCall` / `onMessage` routing; used by the audit harness to react to platform-pushed events that don't correspond to a tracked Call / Message

## Logger getters (TS public `log` accessor)

Python exposes `self.log` as an instance attribute (set in __init__) on
several classes; the TS port surfaces the same logger as a `readonly log`
getter so consumers and subclasses can access the structured Logger
without going through the constructor argument.

signalwire.agent_server.AgentServer.log: TS public `log` getter — Python keeps `self.log` as an instance attribute that the Python adapter excludes as state; TS emits as a class-typed accessor so it shows up in the surface
signalwire.core.agent_base.AgentBase.log: TS public `log` getter — Python keeps `self.log` as an instance attribute that the Python adapter excludes as state; TS emits as a class-typed accessor so it shows up in the surface
signalwire.core.swml_service.SWMLService.log: TS public `log` getter — Python keeps `self.log` as an instance attribute that the Python adapter excludes as state; TS emits as a class-typed accessor so it shows up in the surface

## AgentBase additional port-specific accessors

signalwire.core.agent_base.AgentBase.create_tool_token: TS public delegate to `SessionManager.createToolToken` exposed on AgentBase for convenience; Python keeps this only on SessionManager and accesses via `self.session_manager.create_tool_token(...)`
signalwire.core.agent_base.AgentBase.prompt_sections: TS public getter returning the agent's POM-rendered prompt sections; Python uses methods on the prompt manager / mixin (`get_prompt_sections`) rather than a direct property

## AuthHandler / SkillBase / VerbHandler additional port-specific getters

signalwire.core.auth_handler.AuthHandler.config: TS readonly `config` accessor exposes the AuthConfig passed to the constructor; Python keeps the equivalent as a private attribute and never re-exposes it as a method
signalwire.core.skill_base.SkillBase.agent: TS readonly `agent` accessor exposes the parent agent reference; Python keeps the equivalent as a protected attribute that subclasses access directly
signalwire.core.skill_base.SkillBase.config: TS readonly `config` accessor exposes the SkillConfig passed at construction; Python keeps the equivalent as a protected attribute that subclasses access directly
signalwire.core.swml_handler.AIVerbHandler.validate_config: TS-emitted concrete override of the inherited abstract method from SWMLVerbHandler; Python only emits it on the parent class via the enumerator's declaration-only rule

## SWMLService additional port-specific surface

These are direct accessor methods or build/runtime helpers that TS exposes
on SWMLService; Python distributes the same concepts across mixins and
the ToolRegistry rather than declaring them on the base service class.

signalwire.core.swml_service.SWMLService.build_swml_for_request: TS extension hook subclasses override to render a per-request SWML document; Python equivalent lives on AgentBase as `_render_swml(...)` and isn't exposed as a public method on SWMLService
signalwire.core.swml_service.SWMLService.get_function: TS-port direct accessor on SWMLService for the underlying tool registry; Python keeps this on `ToolRegistry` and accesses via `agent.tool_registry.get_function(...)`
signalwire.core.swml_service.SWMLService.has_function: TS-port direct accessor on SWMLService for the underlying tool registry; Python keeps this on `ToolRegistry` and accesses via `agent.tool_registry.has_function(...)`
signalwire.core.swml_service.SWMLService.remove_function: TS-port direct accessor on SWMLService for the underlying tool registry; Python keeps this on `ToolRegistry` and accesses via `agent.tool_registry.remove_function(...)`
signalwire.core.swml_service.SWMLService.swml_builder: TS-port readonly accessor exposing the internal SwmlBuilder instance; Python keeps the equivalent as a private attribute used only inside the service
signalwire.core.swml_service.SWMLService.validate_basic_auth: TS-port direct accessor on SWMLService for the auth-mixin functionality; Python keeps this on `AuthMixin` and accesses via the mixin chain

## LiveWire / prefabs additional port-specific accessors

signalwire.livewire.AgentHandoff.agent: TS readonly accessor exposing the target agent on a handoff result; LiveKit-compat shim only exposed in TS
signalwire.livewire.JobContext.proc: TS LiveKit-compat process placeholder accessor; SignalWire ignores this field but TS exposes it for type compatibility with @livekit/agents callers
signalwire.livewire.JobContext.room: TS LiveKit-compat room placeholder accessor; SignalWire does not use the LiveKit room abstraction but TS exposes the field for type compatibility
signalwire.livewire.RunContext.session: TS readonly accessor exposing the AgentSession instance from a tool-call run context; Python uses a plain attribute with no public getter
signalwire.prefabs.faq_bot.FAQBotAgent.faqs: TS public `faqs` field exposed for inspection / extension; Python keeps the equivalent FAQ list as a constructor-only argument with no instance accessor
signalwire.prefabs.survey.SurveyAgent.questions: TS public `questions` field exposed for inspection / extension; Python keeps the equivalent question list as a constructor-only argument with no instance accessor

## Relay Action / REST resource port-specific accessors

signalwire.relay.call.Action.call: TS readonly accessor exposing the parent Call instance from an Action; Python keeps the back-reference as a private attribute that callers don't need
signalwire.rest._base.CrudResource.__init__: TS-port explicit constructor for the abstract CrudResource; Python inherits BaseResource's `__init__` implicitly so the enumerator only emits it on the base
signalwire.rest._base.CrudWithAddresses.__init__: TS-port explicit constructor for the abstract CrudWithAddresses; Python inherits BaseResource's `__init__` implicitly so the enumerator only emits it on the base
signalwire.rest._base.ReadResource.__init__: TS-port explicit constructor for the abstract ReadResource (list/get base); Python inherits BaseResource's `__init__` implicitly so the enumerator only emits it on the base
signalwire.rest.client.RestClient.compat: Twilio-compatible LAML namespace, hand-written in the TS port (no OpenAPI spec in this porting-sdk checkout, so it is NOT part of the generated client tree); the Python reference here has no compat namespace. The generated flat resources + namespace containers are wired by the `_GeneratedResourceTree` base (skipped by the enumerator, mirroring Python's private `_GeneratedResourceTree`), so `compat` is the only resource accessor RestClient itself declares.

## AgentBase / SWMLService / SkillRegistry surface additions

signalwire.core.agent_base.AgentBase.pom: TS exposes a `pom` getter returning a `PromptObjectModel` instance (Python parity); Python's `pom` is an instance attribute that the surface enumerator excludes (Python only includes methods/classmethods, not class-level attribute names)
signalwire.core.pom_builder.PomBuilder.pom: TS exposes a `pom` getter returning the wrapped `PromptObjectModel` (Python parity); Python's `pom` is an instance attribute on PomBuilder that the surface enumerator excludes (Python only includes methods, not instance-level attribute names)
signalwire.core.swml_service.SWMLService.get_all_functions: TS-port direct accessor on SWMLService for the underlying tool registry; Python keeps this on `ToolRegistry` and accesses via `agent.tool_registry.get_all_functions()`
signalwire.skills.registry.SkillRegistry.get_external_paths: TS-native method on the singleton SkillRegistry, returning paths added via addSearchPath; Python's equivalent state is private and there is no public accessor

## Webhook signature validation: Hono middleware

signalwire.core.security.webhook_middleware.webhook_validation_middleware: TS port ships a Hono middleware factory equivalent to Python's FastAPI `make_webhook_validation_dependency` (see PORT_OMISSIONS.md); both wrap the shared `validateWebhookSignature` core but use each language's dominant HTTP framework idiom.
