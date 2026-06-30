# PORT_SIGNATURE_OMISSIONS.md

Documented signature divergences between this TypeScript port and the
Python reference. Names-only divergences live in PORT_OMISSIONS.md /
PORT_ADDITIONS.md and are inherited automatically.

Format:
    <fully.qualified.symbol>: <one-line rationale>

Excused divergences fall into:

1. **Idiom-level** (deliberate, not fixable without breaking TS API style):
   - TS constructors take TS-shaped option objects rather than Python kwargs.
   - TS methods return ``this`` for fluent chaining; Python returns None.
   - TS optional parameters use ``?`` syntax; carrying defaults differs.

2. **Port maintenance backlog** (tracked here; will be reduced as the TS
   port catches up to Python signature parity).


## Idiom: TS constructors

signalwire.agent_server.AgentServer.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.core.agent_base.AgentBase.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.core.auth_handler.AuthHandler.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.core.contexts.ContextBuilder.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.core.contexts.GatherInfo.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.core.contexts.GatherQuestion.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.core.pom_builder.PomBuilder.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.core.security.session_manager.SessionManager.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.core.security_config.SecurityConfig.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.core.skill_base.SkillBase.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.core.skill_manager.SkillManager.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.core.swaig_function.SWAIGFunction.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.core.swml_builder.SWMLBuilder.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.core.swml_service.SWMLService.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.core.swml_service.SecurityConfig.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
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
signalwire.prefabs.concierge.ConciergeAgent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.prefabs.faq_bot.FAQBotAgent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.prefabs.info_gatherer.InfoGathererAgent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.prefabs.receptionist.ReceptionistAgent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.prefabs.survey.SurveyAgent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.call.AIAction.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.call.Action.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.call.Call.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.call.CollectAction.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.call.DetectAction.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.call.FaxAction.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.call.PayAction.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.call.PlayAction.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.call.RecordAction.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.call.StandaloneCollectAction.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.call.StreamAction.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.call.TapAction.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.call.TranscribeAction.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.call.Call.device: TS declares `device: Device` as a typed class field; Python has the same attribute but sets it dynamically (`self.device = device or {}`), so the static signature enumerator records it "in port, not in reference". Same attribute, stronger TS typing (the Device union from the Tier-3 typed-objects pass).
signalwire.relay.event.CallReceiveEvent.device: TS declares `device: Device` as a typed class field; Python sets the same attribute dynamically in __init__, so the enumerator records it "in port, not in reference". Same attribute, stronger TS typing.
signalwire.relay.event.CallStateEvent.device: TS declares `device: Device` as a typed class field; Python sets the same attribute dynamically in __init__, so the enumerator records it "in port, not in reference". Same attribute, stronger TS typing.
signalwire.relay.event.TapEvent.device: TS declares `device: Device` as a typed class field; Python sets the same attribute dynamically in __init__, so the enumerator records it "in port, not in reference". Same attribute, stronger TS typing.
signalwire.relay.client.RelayClient.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.client.RelayError.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.MessageReceiveEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.MessageStateEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.QueueEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.RecordEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.TranscribeEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.message.Message.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest._base.HttpClient.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.client.RestClient.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.compat.CompatApplications.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.compat.CompatCalls.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.compat.CompatConferences.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.compat.CompatFaxes.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.compat.CompatLamlBins.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.compat.CompatMessages.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.compat.CompatQueues.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.compat.CompatRecordings.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.compat.CompatTokens.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.compat.CompatTranscriptions.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.fabric.CallFlowsResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.fabric.ConferenceRoomsResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.fabric.CxmlApplicationsResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.fabric.FabricAddresses.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.fabric.FabricResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.fabric.FabricResourcePUT.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.fabric.GenericResources.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.fabric.SubscribersResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.logs.ConferenceLogs.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.logs.FaxLogs.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.logs.MessageLogs.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.logs.VoiceLogs.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.registry.RegistryBrands.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.registry.RegistryCampaigns.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.registry.RegistryNumbers.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.registry.RegistryOrders.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.video.VideoConferenceTokens.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.video.VideoConferences.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.video.VideoRoomRecordings.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.video.VideoRoomSessions.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.video.VideoRoomTokens.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.video.VideoRooms.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.video.VideoStreams.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.skills.api_ninjas_trivia.skill.ApiNinjasTriviaSkill.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.skills.play_background_file.skill.PlayBackgroundFileSkill.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.skills.spider.skill.SpiderSkill.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.skills.weather_api.skill.WeatherApiSkill.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.utils.schema_utils.SchemaUtils.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.web.web_service.WebService.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs

## Idiom: TS fluent API returns this

signalwire.agent_server.AgentServer.get_agents: TS fluent API returns this for chaining
signalwire.core.auth_handler.AuthHandler.get_auth_info: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.create_payment_action: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.create_payment_parameter: TS fluent API returns this for chaining
signalwire.core.pom_builder.PomBuilder.get_section: TS fluent API returns this for chaining
signalwire.core.pom_builder.PomBuilder.to_dict: TS fluent API returns this for chaining
signalwire.core.security.session_manager.SessionManager.debug_token: TS fluent API returns this for chaining
signalwire.core.skill_base.SkillBase.get_prompt_sections: TS fluent API returns this for chaining
signalwire.skills.registry.SkillRegistry.list_skills: TS fluent API returns this for chaining

## Backlog: real signature divergences (754 symbols)

Real TS port maintenance — parameter renames, missing optionals,
type imprecisions. Triage in a separate sweep.

signalwire.agent_server.AgentServer.register_global_routing_callback: BACKLOG / param-mismatch/ param[1] (callback_fn)/ type 'callable<list<class/Request,dict<string,any>>,opti
signalwire.agent_server.AgentServer.run: BACKLOG / param-count-mismatch/ reference has 5 param(s), port has 3/ reference=['self', 'event', 'context', 'ho; return-mismatch/
signalwire.cli.agent_loader.list_agents: BACKLOG / missing-reference/ in port, not in reference
signalwire.cli.agent_loader.load_agent: BACKLOG / missing-reference/ in port, not in reference
signalwire.cli.mock_data.generate_fake_post_data: BACKLOG / missing-reference/ in port, not in reference
signalwire.cli.mock_data.generate_minimal_post_data: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent.prompt.manager.PromptManager.get_prompt: BACKLOG / return-mismatch/ returns 'optional<union<list<dict<string,any>>,string>>' vs 'string'
signalwire.core.agent.prompt.manager.PromptManager.prompt_add_section: BACKLOG / missing-port/ in reference, not in port
signalwire.core.agent.prompt.manager.PromptManager.prompt_add_subsection: BACKLOG / missing-port/ in reference, not in port
signalwire.core.agent.prompt.manager.PromptManager.prompt_add_to_section: BACKLOG / missing-port/ in reference, not in port
signalwire.core.agent.tools.registry.ToolRegistry.define_tool: BACKLOG / missing-port/ in reference, not in port
signalwire.core.agent.tools.type_inference.create_typed_handler_wrapper: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 3/ reference=['func', 'has_raw_data'] port=['; return-mismatch/
signalwire.core.agent.tools.type_inference.infer_schema: BACKLOG / param-mismatch/ param[0] (func)/ name 'func' vs 'fn'; type 'any' vs 'callable<list<any>,any>'; return-mismatch/ returns 
signalwire.core.agent_base.AgentBase.on_debug_event: BACKLOG / param-mismatch/ param[1] (handler)/ name 'handler' vs '_event'; type 'class/Callable' vs 'dict<s; return-mismatch/ retur
signalwire.core.agent_base.AgentBase.on_summary: BACKLOG / param-mismatch/ param[1] (summary)/ name 'summary' vs '_summary'; type 'optional<dict<string,any; param-mismatch/ param[
signalwire.core.agent_base.AgentBase.register_routing_callback: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.setup_graceful_shutdown: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.auth_handler.AuthHandler.verify_basic_auth: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 3/ reference=['self', 'credentials'] port=['s
signalwire.core.auth_handler.AuthHandler.verify_bearer_token: BACKLOG / param-mismatch/ param[1] (credentials)/ name 'credentials' vs 'token'; type 'class/HTTPAuthoriza
signalwire.core.config_loader.ConfigLoader.substitute_vars: BACKLOG / param-mismatch/ param[2] (max_depth)/ type 'int' vs 'float'
signalwire.core.contexts.Context.add_step: BACKLOG / param-count-mismatch/ reference has 7 param(s), port has 3/ reference=['self', 'name', 'task', 'bullet
signalwire.core.contexts.Context.move_step: BACKLOG / param-mismatch/ param[2] (position)/ type 'int' vs 'float'; return-mismatch/ returns 'class/signalwire.core.contexts.Con
signalwire.core.contexts.GatherInfo.add_question: BACKLOG / param-count-mismatch/ reference has 4 param(s), port has 2/ reference=['self', 'key', 'question', 'kwa; return-mismatch/
signalwire.core.contexts.Step.add_gather_question: BACKLOG / param-count-mismatch/ reference has 7 param(s), port has 2/ reference=['self', 'key', 'question', 'typ; return-mismatch/
signalwire.core.contexts.Step.set_gather_info: BACKLOG / param-count-mismatch/ reference has 4 param(s), port has 2/ reference=['self', 'output_key', 'completi; return-mismatch/
signalwire.core.data_map.DataMap.expression: BACKLOG / param-mismatch/ param[2] (pattern)/ type 'union<class/Pattern,string>' vs 'union<string,string>'; param-mismatch/ param[
signalwire.core.data_map.DataMap.foreach: BACKLOG / param-mismatch/ param[1] (foreach_config)/ name 'foreach_config' vs 'config'; type 'dict<string,; return-mismatch/ retur
signalwire.core.data_map.DataMap.parameter: BACKLOG / param-count-mismatch/ reference has 6 param(s), port has 5/ reference=['self', 'name', 'param_type', '; return-mismatch/
signalwire.core.data_map.DataMap.webhook: BACKLOG / param-count-mismatch/ reference has 7 param(s), port has 4/ reference=['self', 'method', 'url', 'heade; return-mismatch/
signalwire.core.data_map.create_expression_tool: BACKLOG / param-count-mismatch/ reference has 3 param(s), port has 1/ reference=['name', 'patterns', 'parameters
signalwire.core.data_map.create_simple_api_tool: BACKLOG / param-count-mismatch/ reference has 8 param(s), port has 1/ reference=['name', 'url', 'response_templa
signalwire.core.function_result.FunctionResult.add_dynamic_hints: BACKLOG / param-mismatch/ param[1] (hints)/ type 'list<union<dict<string,any>,string>>' vs 'list<union<cla; return-mismatch/ retur
signalwire.core.function_result.FunctionResult.create_payment_prompt: BACKLOG / param-mismatch/ param[1] (actions)/ type 'list<dict<string,string>>' vs 'list<class/signalwire.c; param-mismatch/ param[
signalwire.core.function_result.FunctionResult.execute_rpc: BACKLOG / param-count-mismatch/ reference has 5 param(s), port has 2/ reference=['self', 'method', 'params', 'ca; return-mismatch/
signalwire.core.function_result.FunctionResult.hold: BACKLOG / param-mismatch/ param[1] (timeout)/ type 'int' vs 'float'; return-mismatch/ returns 'class/signalwire.core.function_resu
signalwire.core.function_result.FunctionResult.join_conference: BACKLOG / param-count-mismatch/ reference has 19 param(s), port has 3/ reference=['self', 'name', 'muted', 'beep; return-mismatch/
signalwire.core.function_result.FunctionResult.pay: BACKLOG / param-count-mismatch/ reference has 20 param(s), port has 2/ reference=['self', 'payment_connector_url; return-mismatch/
signalwire.core.function_result.FunctionResult.record_call: BACKLOG / param-count-mismatch/ reference has 12 param(s), port has 2/ reference=['self', 'control_id', 'stereo'; return-mismatch/
signalwire.core.function_result.FunctionResult.send_sms: BACKLOG / param-count-mismatch/ reference has 7 param(s), port has 2/ reference=['self', 'to_number', 'from_numb; return-mismatch/
signalwire.core.function_result.FunctionResult.set_end_of_speech_timeout: BACKLOG / param-mismatch/ param[1] (milliseconds)/ type 'int' vs 'float'; return-mismatch/ returns 'class/signalwire.core.function
signalwire.core.function_result.FunctionResult.set_speech_event_timeout: BACKLOG / param-mismatch/ param[1] (milliseconds)/ type 'int' vs 'float'; return-mismatch/ returns 'class/signalwire.core.function
signalwire.core.function_result.FunctionResult.switch_context: BACKLOG / param-count-mismatch/ reference has 5 param(s), port has 2/ reference=['self', 'system_prompt', 'user_; return-mismatch/
signalwire.core.function_result.FunctionResult.tap: BACKLOG / param-count-mismatch/ reference has 7 param(s), port has 2/ reference=['self', 'uri', 'control_id', 'd; return-mismatch/
signalwire.core.function_result.FunctionResult.toggle_functions: BACKLOG / param-mismatch/ param[1] (function_toggles)/ name 'function_toggles' vs 'toggles'; type 'list<di; return-mismatch/ retur
signalwire.core.function_result.FunctionResult.wait_for_user: BACKLOG / param-count-mismatch/ reference has 4 param(s), port has 2/ reference=['self', 'enabled', 'timeout', '; return-mismatch/
signalwire.core.logging_config.strip_control_chars: BACKLOG / param-count-mismatch/ reference has 3 param(s), port has 1/ reference=['logger', 'method_name', 'event
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.add_language: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.add_mcp_server: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.add_pattern_hint: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.add_pronunciation: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.enable_debug_events: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.enable_mcp_server: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.set_function_includes: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.set_languages: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.set_pronunciations: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.auth_mixin.AuthMixin.get_basic_auth_credentials: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.prompt_mixin.PromptMixin.define_contexts: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.prompt_mixin.PromptMixin.get_prompt: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.prompt_mixin.PromptMixin.prompt_add_section: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.prompt_mixin.PromptMixin.prompt_add_subsection: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.prompt_mixin.PromptMixin.prompt_add_to_section: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.prompt_mixin.PromptMixin.set_prompt_pom: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.skill_mixin.SkillMixin.add_skill: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.skill_mixin.SkillMixin.remove_skill: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.tool_mixin.ToolMixin.define_tool: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.tool_mixin.ToolMixin.define_tools: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.web_mixin.WebMixin.as_router: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.web_mixin.WebMixin.get_app: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.web_mixin.WebMixin.on_swml_request: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.web_mixin.WebMixin.register_routing_callback: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.web_mixin.WebMixin.run: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.web_mixin.WebMixin.serve: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.web_mixin.WebMixin.set_dynamic_config_callback: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.web_mixin.WebMixin.setup_graceful_shutdown: BACKLOG / missing-port/ in reference, not in port
signalwire.core.pom_builder.PomBuilder.add_section: BACKLOG / param-count-mismatch/ reference has 7 param(s), port has 3/ reference=['self', 'title', 'body', 'bulle; return-mismatch/
signalwire.core.pom_builder.PomBuilder.add_subsection: BACKLOG / param-count-mismatch/ reference has 5 param(s), port has 4/ reference=['self', 'parent_title', 'title'; return-mismatch/
signalwire.core.pom_builder.PomBuilder.add_to_section: BACKLOG / param-count-mismatch/ reference has 5 param(s), port has 3/ reference=['self', 'title', 'body', 'bulle; return-mismatch/
signalwire.core.pom_builder.PomBuilder.from_sections: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'sections'] port=['secti
signalwire.core.security.session_manager.SessionManager.set_session_metadata: BACKLOG / param-count-mismatch/ reference has 4 param(s), port has 3/ reference=['self', 'call_id', 'key', 'valu; return-mismatch/
signalwire.core.security_config.SecurityConfig.get_basic_auth: BACKLOG / missing-port/ in reference, not in port
signalwire.core.security_config.SecurityConfig.validate_ssl_config: BACKLOG / missing-port/ in reference, not in port
signalwire.core.skill_base.SkillBase.define_tool: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'tool_def'; kind 'var_keyword' vs 'positiona
signalwire.core.skill_base.SkillBase.get_parameter_schema: BACKLOG / param-count-mismatch/ reference has 1 param(s), port has 0/ reference=['cls'] port=[]; return-mismatch/ returns 'dict<st
signalwire.core.skill_base.SkillBase.validate_env_vars: BACKLOG / return-mismatch/ returns 'bool' vs 'list<string>'
signalwire.core.skill_base.SkillBase.validate_packages: BACKLOG / return-mismatch/ returns 'bool' vs 'list<string>'
signalwire.core.skill_manager.SkillManager.add_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.skill_manager.SkillManager.list_loaded_skills: BACKLOG / missing-port/ in reference, not in port
signalwire.core.skill_manager.SkillManager.list_skills: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.skill_manager.SkillManager.load_skill: BACKLOG / param-count-mismatch/ reference has 4 param(s), port has 3/ reference=['self', 'skill_name', 'skill_cl
signalwire.core.skill_manager.SkillManager.remove_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.skill_manager.SkillManager.unload_skill: BACKLOG / missing-port/ in reference, not in port
signalwire.core.swaig_function.SWAIGFunction.execute: BACKLOG / param-mismatch/ param[2] (raw_data)/ type 'optional<dict<string,any>>' vs 'dict<string,any>'
signalwire.core.swaig_function.SWAIGFunction.to_swaig: BACKLOG / param-count-mismatch/ reference has 5 param(s), port has 4/ reference=['self', 'base_url', 'token', 'c
signalwire.core.swaig_function.SWAIGFunction.validate_args: BACKLOG / return-mismatch/ returns 'tuple<any>' vs 'tuple<bool,list<string>>'
signalwire.core.swml_builder.SWMLBuilder.say: BACKLOG / param-count-mismatch/ reference has 6 param(s), port has 3/ reference=['self', 'text', 'voice', 'langu; return-mismatch/
signalwire.core.swml_handler.AIVerbHandler.build_config: BACKLOG / param-count-mismatch/ reference has 8 param(s), port has 2/ reference=['self', 'prompt_text', 'prompt_
signalwire.core.swml_service.SWMLService.extract_sip_username: BACKLOG / return-mismatch/ returns 'optional<string>' vs 'string'
signalwire.core.swml_service.SWMLService.get_basic_auth_credentials: BACKLOG / param-mismatch/ param[1] (include_source)/ default False vs None; return-mismatch/ returns 'union<tuple<string,string,st
signalwire.core.swml_service.SWMLService.register_routing_callback: BACKLOG / param-mismatch/ param[1] (callback_fn)/ type 'callable<list<class/Request,dict<string,any>>,opti
signalwire.core.swml_service.SWMLService.register_verb_handler: BACKLOG / param-mismatch/ param[1] (handler)/ type 'class/signalwire.core.swml_handler.SWMLVerbHandler' vs
signalwire.core.swml_service.SWMLService.serve: BACKLOG / param-count-mismatch/ reference has 7 param(s), port has 2/ reference=['self', 'host', 'port', 'ssl_ce
signalwire.core.swml_service.SecurityConfig.get_basic_auth: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.swml_service.SecurityConfig.validate_ssl_config: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.swml_service.VerbHandlerRegistry.get_handler: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.swml_service.VerbHandlerRegistry.has_handler: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.swml_service.VerbHandlerRegistry.register_handler: BACKLOG / missing-reference/ in port, not in reference
signalwire.list_skills: BACKLOG / missing-port/ in reference, not in port
signalwire.livewire.Agent.llm_node: BACKLOG / param-mismatch/ param[1] (chat_ctx)/ name 'chat_ctx' vs '_chat_ctx'; param-mismatch/ param[2] (tools)/ name 'tools' vs '
signalwire.livewire.Agent.on_user_turn_completed: BACKLOG / param-mismatch/ param[1] (turn_ctx)/ name 'turn_ctx' vs '_turn_ctx'; param-mismatch/ param[2] (new_message)/ name 'new_m
signalwire.livewire.Agent.session: BACKLOG / missing-reference/ in port, not in reference
signalwire.livewire.Agent.stt_node: BACKLOG / param-mismatch/ param[1] (audio)/ name 'audio' vs '_audio'; param-mismatch/ param[2] (model_settings)/ name 'model_setti
signalwire.livewire.Agent.tts_node: BACKLOG / param-mismatch/ param[1] (text)/ name 'text' vs '_text'; param-mismatch/ param[2] (model_settings)/ name 'model_settings
signalwire.livewire.Agent.update_instructions: BACKLOG / return-mismatch/ returns 'any' vs 'void'
signalwire.livewire.Agent.update_tools: BACKLOG / param-mismatch/ param[1] (tools)/ type 'list<any>' vs 'list<class/signalwire.livewire.FunctionTo; return-mismatch/ retur
signalwire.livewire.AgentServer.rtc_session: BACKLOG / param-count-mismatch/ reference has 6 param(s), port has 3/ reference=['self', 'func', 'agent_name', '; return-mismatch/
signalwire.livewire.AgentSession.generate_reply: BACKLOG / param-mismatch/ param[1] (instructions)/ name 'instructions' vs 'options'; kind 'keyword' vs 'po; return-mismatch/ retur
signalwire.livewire.AgentSession.say: BACKLOG / return-mismatch/ returns 'any' vs 'void'
signalwire.livewire.AgentSession.start: BACKLOG / param-count-mismatch/ reference has 4 param(s), port has 2/ reference=['self', 'agent', 'room', 'recor; return-mismatch/
signalwire.livewire.AgentSession.update_agent: BACKLOG / return-mismatch/ returns 'any' vs 'void'
signalwire.livewire.ChatContext.append: BACKLOG / param-count-mismatch/ reference has 3 param(s), port has 2/ reference=['self', 'role', 'text'] port=['
signalwire.livewire.JobContext.wait_for_participant: BACKLOG / param-mismatch/ param[1] (identity)/ name 'identity' vs 'options'; kind 'keyword' vs 'positional
signalwire.livewire.SileroVAD.load: BACKLOG / missing-reference/ in port, not in reference
signalwire.livewire.run_app: BACKLOG / param-mismatch/ param[0] (server)/ name 'server' vs 'options'; type 'class/signalwire.livewire.A; return-mismatch/ retur
signalwire.livewire.tool: BACKLOG / missing-reference/ in port, not in reference
signalwire.prefabs.concierge.ConciergeAgent.on_summary: BACKLOG / param-mismatch/ param[1] (summary)/ type 'any' vs 'dict<string,any>'; param-mismatch/ param[2] (raw_data)/ name 'raw_dat
signalwire.prefabs.faq_bot.FAQBotAgent.on_summary: BACKLOG / param-mismatch/ param[1] (summary)/ type 'any' vs 'dict<string,any>'; param-mismatch/ param[2] (raw_data)/ name 'raw_dat
signalwire.prefabs.info_gatherer.InfoGathererAgent.on_swml_request: BACKLOG / param-count-mismatch/ reference has 4 param(s), port has 2/ reference=['self', 'request_data', 'callba; return-mismatch/
signalwire.prefabs.info_gatherer.InfoGathererAgent.set_question_callback: BACKLOG / param-mismatch/ param[1] (callback)/ type 'callable<list<dict<any,any>,dict<any,any>,dict<any,an
signalwire.prefabs.receptionist.ReceptionistAgent.on_summary: BACKLOG / param-mismatch/ param[1] (summary)/ name 'summary' vs '_summary'; type 'any' vs 'dict<string,any; param-mismatch/ param[
signalwire.prefabs.survey.SurveyAgent.on_summary: BACKLOG / param-mismatch/ param[1] (summary)/ type 'any' vs 'union<dict<string,any>,string>'; param-mismatch/ param[2] (raw_data)/
signalwire.relay.call.Call.ai: BACKLOG / param-count-mismatch/ reference has 16 param(s), port has 2/ reference=['self', 'control_id', 'agent',
signalwire.relay.call.Call.ai_hold: BACKLOG / param-count-mismatch/ reference has 4 param(s), port has 2/ reference=['self', 'timeout', 'prompt', 'k; return-mismatch/
signalwire.relay.call.Call.ai_message: BACKLOG / param-count-mismatch/ reference has 6 param(s), port has 2/ reference=['self', 'message_text', 'role',; return-mismatch/
signalwire.relay.call.Call.ai_unhold: BACKLOG / param-count-mismatch/ reference has 3 param(s), port has 2/ reference=['self', 'prompt', 'kwargs'] por; return-mismatch/
signalwire.relay.call.Call.amazon_bedrock: BACKLOG / param-count-mismatch/ reference has 8 param(s), port has 2/ reference=['self', 'prompt', 'SWAIG', 'ai_; return-mismatch/
signalwire.relay.call.Call.answer: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'extra'; kind 'var_keyword' vs 'positional';; return-mismatch/ retur
signalwire.relay.call.Call.bind_digit: BACKLOG / param-count-mismatch/ reference has 7 param(s), port has 4/ reference=['self', 'digits', 'bind_method'; return-mismatch/
signalwire.relay.call.Call.clear_digit_bindings: BACKLOG / param-count-mismatch/ reference has 3 param(s), port has 2/ reference=['self', 'realm', 'kwargs'] port; return-mismatch/
signalwire.relay.call.Call.collect: BACKLOG / param-count-mismatch/ reference has 11 param(s), port has 2/ reference=['self', 'digits', 'speech', 'i
signalwire.relay.call.Call.connect: BACKLOG / param-count-mismatch/ reference has 8 param(s), port has 3/ reference=['self', 'devices', 'ringback', ; return-mismatch/
signalwire.relay.call.Call.denoise: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.Call.denoise_stop: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.Call.detect: BACKLOG / param-count-mismatch/ reference has 6 param(s), port has 3/ reference=['self', 'detect', 'timeout', 'c
signalwire.relay.call.Call.detect_answering_machine: Idiom / TS collapses Python's keyword-only AMD args (initial_timeout/end_silence_timeout/machine_voice_threshold/machine_words_threshold/detect_interruptions/detect_message_end/timeout/on_completed) into one options object; emits the same {type:'machine',params:{...only-provided...}} detect media
signalwire.relay.call.Call.detect_digit: Idiom / TS collapses Python's keyword-only digits/timeout/on_completed into one options object; emits the same {type:'digit',params:{digits?}} detect media
signalwire.relay.call.Call.detect_fax: Idiom / TS collapses Python's keyword-only tone/timeout/on_completed into one options object; emits the same {type:'fax',params:{tone?}} detect media
signalwire.relay.call.Call.disconnect: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.Call.echo: BACKLOG / param-count-mismatch/ reference has 4 param(s), port has 2/ reference=['self', 'timeout', 'status_url'; return-mismatch/
signalwire.relay.call.Call.hangup: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.Call.join_conference: BACKLOG / param-count-mismatch/ reference has 22 param(s), port has 3/ reference=['self', 'name', 'muted', 'beep; return-mismatch/
signalwire.relay.call.Call.join_room: BACKLOG / param-count-mismatch/ reference has 4 param(s), port has 3/ reference=['self', 'name', 'status_url', '; return-mismatch/
signalwire.relay.call.Call.leave_conference: BACKLOG / param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'extra'; kind 'var_keyword' vs 'positional';; return-mismatch/ retur
signalwire.relay.call.Call.leave_room: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'extra'; kind 'var_keyword' vs 'positional';; return-mismatch/ retur
signalwire.relay.call.Call.live_transcribe: BACKLOG / param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'extra'; kind 'var_keyword' vs 'positional';; return-mismatch/ retur
signalwire.relay.call.Call.live_translate: BACKLOG / param-count-mismatch/ reference has 4 param(s), port has 3/ reference=['self', 'action', 'status_url',; return-mismatch/
signalwire.relay.call.Call.on: BACKLOG / param-mismatch/ param[2] (handler)/ type 'class/signalwire.relay.call.EventHandler' vs 'callable
signalwire.relay.call.Call.pay: BACKLOG / param-count-mismatch/ reference has 22 param(s), port has 3/ reference=['self', 'payment_connector_url
signalwire.relay.call.Call.play: BACKLOG / param-count-mismatch/ reference has 8 param(s), port has 3/ reference=['self', 'media', 'volume', 'dir
signalwire.relay.call.Call.play_and_collect: BACKLOG / param-count-mismatch/ reference has 7 param(s), port has 4/ reference=['self', 'media', 'collect', 'vo
signalwire.relay.call.Call.play_audio: Idiom / TS collapses Python's keyword-only volume/on_completed into one options object; emits the same [{type:'audio',params:{url}}] play media
signalwire.relay.call.Call.play_ringtone: Idiom / TS collapses Python's keyword-only duration/volume/on_completed into one options object; emits the same [{type:'ringtone',params:{name,duration?}}] play media
signalwire.relay.call.Call.play_silence: Idiom / TS collapses Python's keyword-only on_completed into one options object; emits the same [{type:'silence',params:{duration}}] play media
signalwire.relay.call.Call.play_tts: Idiom / TS collapses Python's keyword-only language/gender/voice/volume/on_completed into one options object; emits the same [{type:'tts',params:{text,language?,gender?,voice?}}] play media
signalwire.relay.call.Call.prompt_audio: Idiom / TS collapses Python's keyword-only volume/on_completed into one options object; emits the same [{type:'audio',params:{url}}] play_and_collect media
signalwire.relay.call.Call.prompt_tts: Idiom / TS collapses Python's keyword-only language/gender/voice/volume/on_completed into one options object; emits the same [{type:'tts',params:{text,language?,gender?,voice?}}] play_and_collect media
signalwire.relay.call.Call.queue_enter: BACKLOG / param-count-mismatch/ reference has 5 param(s), port has 3/ reference=['self', 'queue_name', 'control_; return-mismatch/
signalwire.relay.call.Call.queue_leave: BACKLOG / param-count-mismatch/ reference has 6 param(s), port has 3/ reference=['self', 'queue_name', 'control_; return-mismatch/
signalwire.relay.call.Call.receive_fax: BACKLOG / param-count-mismatch/ reference has 4 param(s), port has 2/ reference=['self', 'control_id', 'on_compl
signalwire.relay.call.Call.record: BACKLOG / param-count-mismatch/ reference has 5 param(s), port has 3/ reference=['self', 'audio', 'control_id', 
signalwire.relay.call.Call.refer: BACKLOG / param-count-mismatch/ reference has 4 param(s), port has 3/ reference=['self', 'device', 'status_url',; return-mismatch/
signalwire.relay.call.Call.send_digits: BACKLOG / param-mismatch/ param[2] (control_id)/ kind 'keyword' vs 'positional'; type 'optional<string>' v; return-mismatch/ retur
signalwire.relay.call.Call.send_fax: BACKLOG / param-count-mismatch/ reference has 7 param(s), port has 3/ reference=['self', 'document', 'identity',
signalwire.relay.call.Call.stream: BACKLOG / param-count-mismatch/ reference has 12 param(s), port has 3/ reference=['self', 'url', 'name', 'codec'
signalwire.relay.call.Call.tap: BACKLOG / param-count-mismatch/ reference has 6 param(s), port has 4/ reference=['self', 'tap', 'device', 'contr
signalwire.relay.call.Call.transcribe: BACKLOG / param-count-mismatch/ reference has 5 param(s), port has 2/ reference=['self', 'control_id', 'status_u
signalwire.relay.call.Call.transfer: BACKLOG / param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'extra'; kind 'var_keyword' vs 'positional';; return-mismatch/ retur
signalwire.relay.call.Call.user_event: BACKLOG / param-count-mismatch/ reference has 3 param(s), port has 2/ reference=['self', 'event', 'kwargs'] port; return-mismatch/
signalwire.relay.call.CollectAction.start_input_timers: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.CollectAction.stop: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.CollectAction.volume: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.DetectAction.stop: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.PayAction.stop: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.PlayAction.pause: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.PlayAction.resume: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.PlayAction.stop: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.PlayAction.volume: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.RecordAction.pause: BACKLOG / param-mismatch/ param[1] (behavior)/ type 'optional<string>' vs 'string'; return-mismatch/ returns 'dict<any,any>' vs 'd
signalwire.relay.call.RecordAction.resume: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.RecordAction.stop: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.StandaloneCollectAction.start_input_timers: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.StandaloneCollectAction.stop: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.StreamAction.stop: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.TapAction.stop: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.client.RelayClient.dial: BACKLOG / param-count-mismatch/ reference has 5 param(s), port has 3/ reference=['self', 'devices', 'tag', 'max_
signalwire.relay.client.RelayClient.on_call: BACKLOG / param-mismatch/ param[1] (handler)/ type 'class/signalwire.relay.client.CallHandler' vs 'callabl; return-mismatch/ retur
signalwire.relay.client.RelayClient.on_message: BACKLOG / param-mismatch/ param[1] (handler)/ type 'class/signalwire.relay.client.MessageHandler' vs 'call; return-mismatch/ retur
signalwire.relay.client.RelayClient.send_message: BACKLOG / param-count-mismatch/ reference has 9 param(s), port has 2/ reference=['self', 'to_number', 'from_numb
signalwire.relay.event.CallReceiveEvent.from_payload: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'payload'] port=['payloa; return-mismatch/
signalwire.relay.event.CallStateEvent.from_payload: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'payload'] port=['payloa; return-mismatch/
signalwire.relay.event.CallingErrorEvent.from_payload: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'payload'] port=['payloa; return-mismatch/
signalwire.relay.event.CollectEvent.from_payload: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'payload'] port=['payloa; return-mismatch/
signalwire.relay.event.ConferenceEvent.from_payload: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'payload'] port=['payloa; return-mismatch/
signalwire.relay.event.ConnectEvent.from_payload: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'payload'] port=['payloa; return-mismatch/
signalwire.relay.event.DenoiseEvent.from_payload: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'payload'] port=['payloa; return-mismatch/
signalwire.relay.event.DetectEvent.from_payload: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'payload'] port=['payloa; return-mismatch/
signalwire.relay.event.DialEvent.from_payload: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'payload'] port=['payloa; return-mismatch/
signalwire.relay.event.EchoEvent.from_payload: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'payload'] port=['payloa; return-mismatch/
signalwire.relay.event.FaxEvent.from_payload: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'payload'] port=['payloa; return-mismatch/
signalwire.relay.event.HoldEvent.from_payload: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'payload'] port=['payloa; return-mismatch/
signalwire.relay.event.MessageReceiveEvent.from_payload: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'payload'] port=['payloa; return-mismatch/
signalwire.relay.event.MessageStateEvent.from_payload: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'payload'] port=['payloa; return-mismatch/
signalwire.relay.event.PayEvent.from_payload: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'payload'] port=['payloa; return-mismatch/
signalwire.relay.event.PlayEvent.from_payload: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'payload'] port=['payloa; return-mismatch/
signalwire.relay.event.QueueEvent.from_payload: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'payload'] port=['payloa; return-mismatch/
signalwire.relay.event.RecordEvent.from_payload: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'payload'] port=['payloa; return-mismatch/
signalwire.relay.event.ReferEvent.from_payload: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'payload'] port=['payloa; return-mismatch/
signalwire.relay.event.RelayEvent.from_payload: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'payload'] port=['payloa; return-mismatch/
signalwire.relay.event.SendDigitsEvent.from_payload: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'payload'] port=['payloa; return-mismatch/
signalwire.relay.event.StreamEvent.from_payload: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'payload'] port=['payloa; return-mismatch/
signalwire.relay.event.TapEvent.from_payload: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'payload'] port=['payloa; return-mismatch/
signalwire.relay.event.TranscribeEvent.from_payload: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['cls', 'payload'] port=['payloa; return-mismatch/
signalwire.relay.message.Message.on: BACKLOG / param-mismatch/ param[1] (handler)/ type 'class/Callable' vs 'callable<list<class/signalwire.rel
signalwire.rest.namespaces.calling.CallingNamespace.dial: BACKLOG / param-mismatch/ param[1] (params)/ kind 'var_keyword' vs 'positional'
signalwire.rest.namespaces.calling.CallingNamespace.update: BACKLOG / param-mismatch/ param[1] (params)/ kind 'var_keyword' vs 'positional'
signalwire.rest.namespaces.chat.ChatResource.create_token: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.compat.CompatAccounts.create: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.compat.CompatPhoneNumbers.import_number: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.compat.CompatPhoneNumbers.purchase: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.compat.CompatTokens.create: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.datasphere.DatasphereDocuments.search: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.fabric.CallFlowsResource.deploy_version: BACKLOG / param-mismatch/ param[1] (resource_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'bod
signalwire.rest.namespaces.fabric.CxmlApplicationsResource.create: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['self', 'kwargs'] port=['self']
signalwire.rest.namespaces.fabric.GenericResources.assign_domain_application: BACKLOG / param-mismatch/ param[1] (resource_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'bod
signalwire.rest.namespaces.fabric.GenericResources.assign_phone_route: BACKLOG / param-mismatch/ param[1] (resource_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'bod
signalwire.rest.namespaces.fabric.SubscribersResource.create_sip_endpoint: BACKLOG / param-mismatch/ param[1] (subscriber_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'b
signalwire.rest.namespaces.fabric.SubscribersResource.update_sip_endpoint: BACKLOG / param-mismatch/ param[1] (subscriber_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (endpoint_id)/ type 'any' vs 
signalwire.rest.namespaces.mfa.MfaResource.call: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.mfa.MfaResource.sms: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.mfa.MfaResource.verify: BACKLOG / param-mismatch/ param[1] (request_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body
signalwire.rest.namespaces.number_groups.NumberGroupsResource.add_membership: BACKLOG / param-mismatch/ param[1] (group_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body';
signalwire.rest.namespaces.phone_numbers.PhoneNumbersResource.set_ai_agent: BACKLOG / param-mismatch/ param[3] (extra)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<string; return-mismatch/ retur
signalwire.rest.namespaces.phone_numbers.PhoneNumbersResource.set_call_flow: BACKLOG / param-count-mismatch/ reference has 5 param(s), port has 3/ reference=['self', 'resource_id', 'flow_id; return-mismatch/
signalwire.rest.namespaces.phone_numbers.PhoneNumbersResource.set_cxml_application: BACKLOG / param-mismatch/ param[3] (extra)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<string; return-mismatch/ retur
signalwire.rest.namespaces.phone_numbers.PhoneNumbersResource.set_cxml_webhook: BACKLOG / param-count-mismatch/ reference has 6 param(s), port has 3/ reference=['self', 'resource_id', 'url', '; return-mismatch/
signalwire.rest.namespaces.phone_numbers.PhoneNumbersResource.set_relay_application: BACKLOG / param-mismatch/ param[3] (extra)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<string; return-mismatch/ retur
signalwire.rest.namespaces.phone_numbers.PhoneNumbersResource.set_relay_topic: BACKLOG / param-count-mismatch/ reference has 5 param(s), port has 3/ reference=['self', 'resource_id', 'topic',; return-mismatch/
signalwire.rest.namespaces.phone_numbers.PhoneNumbersResource.set_swml_webhook: BACKLOG / param-mismatch/ param[3] (extra)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'class/signa; return-mismatch/ retur
signalwire.rest.namespaces.project.ProjectTokens.create: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.project.ProjectTokens.update: BACKLOG / param-mismatch/ param[1] (token_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body';
signalwire.rest.namespaces.pubsub.PubSubResource.create_token: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.registry.RegistryBrands.create: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.registry.RegistryBrands.create_campaign: BACKLOG / param-mismatch/ param[1] (brand_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body';
signalwire.rest.namespaces.verified_callers.VerifiedCallersResource.submit_verification: BACKLOG / param-mismatch/ param[1] (caller_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body'
signalwire.rest.namespaces.video.VideoConferences.create_stream: BACKLOG / param-mismatch/ param[1] (conference_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'b
signalwire.rest.namespaces.video.VideoRoomTokens.create: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.video.VideoRooms.create_stream: BACKLOG / param-mismatch/ param[1] (room_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body'; 
signalwire.rest.namespaces.video.VideoStreams.update: BACKLOG / param-mismatch/ param[1] (stream_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body'
signalwire.rest.pagination.paginate: BACKLOG / missing-reference/ in port, not in reference
signalwire.rest.pagination.paginate_all: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.api_ninjas_trivia.skill.ApiNinjasTriviaSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.api_ninjas_trivia.skill.ApiNinjasTriviaSkill.get_tools: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.builtin.index.register_builtin_skills: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.claude_skills.skill.ClaudeSkillsSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.datasphere.skill.DataSphereSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.datasphere_serverless.skill.DataSphereServerlessSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.datetime.skill.DateTimeSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.google_maps.skill.GoogleMapsSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.info_gatherer.skill.InfoGathererSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.joke.skill.JokeSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.math.skill.MathSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.native_vector_search.skill.NativeVectorSearchSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.play_background_file.skill.PlayBackgroundFileSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.play_background_file.skill.PlayBackgroundFileSkill.get_tools: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.registry.SkillRegistry.add_search_path: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.registry.SkillRegistry.discover_from_directory: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.registry.SkillRegistry.discover_skills: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.registry.SkillRegistry.register: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.registry.SkillRegistry.register_skill: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.spider.skill.SpiderSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.weather_api.skill.WeatherApiSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.weather_api.skill.WeatherApiSkill.get_tools: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.web_search.skill.WebSearchSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.wikipedia_search.skill.WikipediaSearchSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.utils.schema_utils.SchemaUtils.validate_verb: BACKLOG / param-mismatch/ param[2] (verb_config)/ name 'verb_config' vs 'config'; type 'dict<string,any>' ; return-mismatch/ retur
signalwire.web.web_service.WebService.start: BACKLOG / param-mismatch/ param[1] (host)/ default '0.0.0.0' vs None; param-mismatch/ param[2] (port)/ type 'optional<int>' vs 'fl

## Idiom: TS file co-locates support classes (return-type module path differs)

The TS port keeps `SecurityConfig` and `VerbHandlerRegistry` declared
inside `SWMLService.ts` rather than in a dedicated file like Python's
`security_config.py` / `swml_handler.py`. Public `security` /
`verb_registry` getters return the same conceptual class but the
canonical path differs.

signalwire.core.swml_service.SWMLService.security: TS declares `SecurityConfig` inside `SWMLService.ts`; getter returns `class:signalwire.core.swml_service.SecurityConfig` while Python returns `class:signalwire.core.security_config.SecurityConfig`
signalwire.core.swml_service.SWMLService.verb_registry: TS declares `VerbHandlerRegistry` inside `SWMLService.ts`; getter returns `class:signalwire.core.swml_service.VerbHandlerRegistry` while Python returns `class:signalwire.core.swml_handler.VerbHandlerRegistry`

## TS-idiomatic return-type divergences

signalwire.core.skill_base.SkillBase.logger: TS port returns a `Logger` instance from `signalwire.core.logging_config.Logger`; Python's `logger` typing uses the `get_logger` factory's return-type annotation, so the canonical path resolves to `get_logger` rather than `Logger` — same logger object, different name in the canonical path

## TS-idiomatic params-object vs **kwargs

signalwire.rest._base.CrudResource.create: TS REST resources accept a single `body: any` positional argument (matching their JSON request body); Python uses `**kwargs` which the audit reports as a `var_keyword`-vs-`positional` kind mismatch. Same call-site contract — a flat key/value bag.
signalwire.rest._base.CrudResource.update: TS REST resources accept a single `body: any` positional argument (matching their JSON request body); Python uses `**kwargs` which the audit reports as a `var_keyword`-vs-`positional` kind mismatch. Same call-site contract — a flat key/value bag.
signalwire.pom.pom.PromptObjectModel.add_section: TS PromptObjectModel.addSection takes (title, opts) where opts={ body, bullets, numbered, numberedBullets } — mirrors Python's keyword-only params after `title`. Same call-site contract.
signalwire.pom.pom.Section.__init__: TS Section constructor takes (title, opts) where opts={ body, bullets, numbered, numberedBullets } — mirrors Python's keyword-only params after `title`. Same call-site contract.
signalwire.pom.pom.Section.add_subsection: TS Section.addSubsection takes (title, opts) where opts={ body, bullets, numbered, numberedBullets } — mirrors Python's keyword-only params after `title`. Same call-site contract.

## POM int vs float (TS has no integer type)

signalwire.pom.pom.Section.render_markdown: TS `level` and `section_number` params resolve to `float` because TypeScript has a single `number` primitive — no separate int. Equivalent to Python's `int` for all valid inputs.
signalwire.pom.pom.Section.render_xml: TS `indent` and `section_number` params resolve to `float` because TypeScript has a single `number` primitive — no separate int. Equivalent to Python's `int` for all valid inputs.

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
signalwire.core.skill_base.SkillBase.get_skill_data: TS types the raw_data param as `class:...SwaigRequestData` (the canonical SWAIG-webhook request shape, swml.md); Python types it `Dict[str, Any]`. Same payload, stronger TS typing.

## Webhook validator: optional<union<...>> vs union<...,void>

signalwire.core.security.webhook_validator.validate_request: Python's source uses `Union[str, Mapping[str, Any], List[Tuple[str, Any]], None]`, which the canonical translator emits as `union<...,void>`; TypeScript's `string | Record<string, unknown> | Array<[string, unknown]> | null | undefined` is emitted as `optional<union<...>>` because the TS translator collapses null/undefined into the `optional<...>` wrapper rather than keeping `void` as a sibling union member. Same call-site contract; both forms accept the same set of values at runtime.

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

signalwire.rest.namespaces.calling_resources_generated.Calling.live_transcribe: `action` param — flat `union<LiveTranscribeStartAction,LiveTranscribeSummarizeAction,LiveTranscribeStopAction>` vs the reference's right-nested griffe rendering of the same three-variant `anyOf`. Identical wire contract.
signalwire.rest.namespaces.calling_resources_generated.Calling.live_translate: `action` param — flat union of the four LiveTranslate*Action variants vs the reference's right-nested griffe rendering of the same `anyOf`. Identical wire contract.
