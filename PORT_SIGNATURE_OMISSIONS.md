# PORT_SIGNATURE_OMISSIONS.md

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
   - **framework / typed-shape**: TS omits FastAPI-specific wrapper types
     (``Request``/``HTTPAuthorizationCredentials``) that have no Hono/TS analog,
     and types payloads/returns as named shapes where Python uses ``dict``/``Any``
     (TS strictly richer — never loosened; same emitted wire, proven by EMISSION).

2. **Reference-oracle gaps**: symbols the port genuinely implements but that are
   absent from ``python_signatures.json`` (griffe enumeration gaps — e.g. the
   whole ``signalwire.livewire`` module, and per-skill ``get_parameter_schema``
   accessors whose skill class the oracle records no signatures for).

3. **Port additions**: TS-only helpers with no Python-reference counterpart
   (CLI loaders, pagination helpers, compile-time tool-typing helpers, file-
   co-located registries).


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

## Idiom: TS options-object vs Python positional-or-keyword params

signalwire.core.agent.prompt.manager.PromptManager.prompt_add_section: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.agent.prompt.manager.PromptManager.prompt_add_subsection: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.agent.prompt.manager.PromptManager.prompt_add_to_section: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.contexts.GatherInfo.add_question: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.contexts.Step.add_gather_question: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.contexts.Step.set_gather_info: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.data_map.DataMap.parameter: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.data_map.DataMap.webhook: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.data_map.create_expression_tool: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.data_map.create_simple_api_tool: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.function_result.FunctionResult.execute_rpc: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.function_result.FunctionResult.join_conference: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.function_result.FunctionResult.pay: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.function_result.FunctionResult.record_call: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.function_result.FunctionResult.send_sms: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.function_result.FunctionResult.switch_context: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.function_result.FunctionResult.tap: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.function_result.FunctionResult.wait_for_user: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.add_language: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.add_mcp_server: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.add_pattern_hint: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.add_pronunciation: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.mixins.prompt_mixin.PromptMixin.prompt_add_section: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.mixins.prompt_mixin.PromptMixin.prompt_add_subsection: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.mixins.prompt_mixin.PromptMixin.prompt_add_to_section: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.pom_builder.PomBuilder.add_section: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.pom_builder.PomBuilder.add_subsection: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.pom_builder.PomBuilder.add_to_section: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).
signalwire.core.swml_builder.SWMLBuilder.say: ts-options-object: TS collapses the Python method's positional-or-keyword arguments into one trailing options object (a keyword-passing bag). The enumerator unfolds the members back to keyword params, but the Python reference records these as positional (positional-or-keyword), not keyword-only, so the param KIND reads as a mismatch. Functionally identical: every value is passed by name to the same wire slot; types erase and the emitted wire bytes are unchanged. TS cannot express Python's positional-or-keyword affordance through an options object (same class as Go's go-variadic-options idiom).

## Idiom: TS options-object serve/run collapse

signalwire.core.mixins.web_mixin.WebMixin.run: ts-options-object: run() takes a single options object (serverless event/context/force_mode/host/port collapsed); Python records them as positional-or-keyword. The serverless return is a typed ServerlessResponse|void where Python is Optional[dict|str] — the TS type is the precise serialized shape (same JSON).
signalwire.core.mixins.web_mixin.WebMixin.serve: ts-options-object: serve(opts) collapses Python's host/port positional-or-keyword params into one options object; same values, keyword-passed.
signalwire.core.swml_service.SWMLService.serve: ts-options-object: serve(host_or_opts, port?, opts?) collapses Python's host/port/ssl_cert/ssl_key/ssl_enabled/domain positional-or-keyword params into an overloaded options object; same values, keyword-passed.
signalwire.agent_server.AgentServer.run: ts-options-object: run(host?, port?) — the TS AgentServer.run omits Python's serverless event/context leading params (those belong to the per-agent serverless entrypoint, not the multi-agent HTTP server); host/port are the same values.

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
signalwire.core.mixins.web_mixin.WebMixin.on_swml_request: TS types request_data as SwmlRequestData (canonical dynamic-SWML request shape) where Python has Optional[dict]; the framework `request` param (FastAPI Request) has no Hono/TS analog and is untyped. Same payload, TS stricter on the body.
signalwire.core.mixins.web_mixin.WebMixin.register_routing_callback: TS callback receives the typed SwmlRequestData and returns string (route); Python's callback takes (Request, dict) -> Optional[str]. The FastAPI Request has no TS analog; the dict is typed as SwmlRequestData. Same routing contract, TS stricter payload.
signalwire.core.swml_service.SWMLService.register_routing_callback: TS callback receives the typed SwmlRequestData and returns string; Python's callback takes (Request, dict) -> Optional[str]. FastAPI Request has no TS analog; same routing contract, TS stricter payload.
signalwire.agent_server.AgentServer.register_global_routing_callback: TS callback receives the typed SwmlRequestData and returns string; Python's callback takes (Request, dict) -> Optional[str]. FastAPI Request has no TS analog; same routing contract, TS stricter payload.
signalwire.core.mixins.web_mixin.WebMixin.set_dynamic_config_callback: TS callback's 2nd arg is typed SwmlRequestData (canonical dynamic-SWML request); Python types it dict[str,Any]. Same callback contract, TS stricter payload.
signalwire.prefabs.info_gatherer.InfoGathererAgent.set_question_callback: TS callback receives a typed SwmlRequestData + returns list<InfoGathererQuestion> (named shapes) where Python uses dicts. Same callback contract, TS stricter.

## Idiom: TS overload set expresses the Python union (enumerator records first overload)

signalwire.core.mixins.auth_mixin.AuthMixin.get_basic_auth_credentials: TS overloads express the full union: (includeSource?: false) -> [string,string] and (includeSource: true) -> [string,string,source]. The enumerator records only the first overload; the union is present and in fact stricter (source is a literal union). Same contract.
signalwire.core.swml_service.SWMLService.get_basic_auth_credentials: TS overloads express the full [string,string] | [string,string,source] union; the enumerator records only the first overload. Same contract, TS stricter.
signalwire.core.security.session_manager.SessionManager.set_session_metadata: TS overloads: (sessionId, metadata) -> void (TS-native bulk merge) and (sessionId, key, value) -> boolean (the Python-compatible 3-arg form matching set_session_metadata(call_id,key,value)->bool). The enumerator records the first (bulk) overload; the Python-parity overload exists. session_id≡call_id (rename).

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

signalwire.core.auth_handler.AuthHandler.verify_bearer_token: Python takes a FastAPI HTTPAuthorizationCredentials wrapper and immediately reads .credentials (the raw token); TS has no FastAPI so it takes the already-unwrapped token: string. Same value compared.
signalwire.core.auth_handler.AuthHandler.verify_basic_auth: Python takes a single FastAPI HTTPBasicCredentials wrapper; TS takes the unwrapped (username, password) pair directly (no FastAPI credentials object). Same two values.
signalwire.core.data_map.DataMap.expression: TS types pattern as string | RegExp; Python uses str | Pattern[str]. RegExp is the TS analog of Python's compiled Pattern — a rename-map equivalence, not a divergence.
signalwire.core.agent_base.AgentBase.on_debug_event: Python on_debug_event is a decorator that registers and returns a handler (Callable->Callable); TS onDebugEvent(event) is the idiomatic overridable receiver hook that consumes the event and returns void. Same debug-event capability, different (Pythonic vs OO) registration mechanism.
signalwire.core.skill_base.SkillBase.define_tool: Python define_tool(**kwargs) is untyped keyword-splat; TS defineTool(toolDef: SkillToolDefinition) collapses it into one typed options object (the canonical TS translation of **kwargs). TS stricter.
signalwire.core.logging_config.strip_control_chars: Python strip_control_chars(logger, method_name, event_dict) is a structlog processor (3-arg processor protocol); the TS logging layer is not structlog-based, so the equivalent helper takes just the data payload to sanitize. Same sanitization behavior, no structlog processor protocol in TS.
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.add_language: ts-options-object: addLanguage(config) collapses Python's name/code/voice/speech_fillers/function_fillers/engine/model/params positional-or-keyword args into one config object; same values, keyword-passed.
signalwire.core.skill_manager.SkillManager.load_skill: ts-options-object: loadSkill(skillClass, config) — the skill_name is derived from the class's static SKILL_NAME (not a separate arg) and params collapse into config; same load contract.
signalwire.core.mixins.skill_mixin.SkillMixin.add_skill: ts-options-object: addSkillByName(skill, params?) — the params dict collapses into an optional object; same add-by-name contract.
signalwire.core.swaig_function.SWAIGFunction.to_swaig: TS toSwaig(base_url, token, call_id) omits Python's include_auth flag (auth inclusion is derived from token presence in the TS emitter); same emitted SWAIG entry.
signalwire.core.swml_handler.AIVerbHandler.build_config: ts-options-object: buildConfig(opts) collapses Python's prompt_text/prompt_pom/contexts/post_prompt/post_prompt_url/swaig/**kwargs into one options object; same AI verb config emitted.
signalwire.core.agent.tools.registry.ToolRegistry.define_tool: ts-options-object: defineTool(opts) collapses Python's name/description/parameters/handler/secure/fillers/wait_file/wait_file_loops/webhook_url/required/is_typed_handler/swaig_fields into one options object; same tool registered.
signalwire.core.mixins.tool_mixin.ToolMixin.define_tool: ts-options-object: defineTool(opts) collapses Python's name/description/parameters/handler/secure/fillers/webhook_url/required/is_typed_handler/swaig_fields into one options object; same tool registered.
signalwire.core.skill_base.SkillBase.get_parameter_schema: TS get_parameter_schema is a static accessor with no cls receiver; Python is a classmethod (cls). Same static schema, no cls param in the TS static form.
signalwire.prefabs.info_gatherer.InfoGathererAgent.on_swml_request: TS onSwmlRequest(rawData) receives the request payload; Python on_swml_request(request_data, callback_path, request) additionally threads FastAPI callback_path/Request which have no Hono/TS analog. Same dynamic-SWML hook.
signalwire.relay.call.Call.clear_digit_bindings: TS clearDigitBindings(realm?) omits Python's trailing **kwargs passthrough (no extra fields are forwarded to this relay method in TS); same clear-bindings wire command.
signalwire.relay.call.Call.user_event: ts-options-object: userEvent(options) collapses Python's event + **kwargs into one options object; same user_event wire command.
signalwire.relay.call.Call.send_digits: TS sendDigits(digits, controlId?) takes control_id positionally where Python makes it keyword-only; same send_digits wire command with the same fields.
signalwire.relay.call.Call.amazon_bedrock: TS amazonBedrock(options) types the collapsed prompt as required-in-context where Python records Optional[Any]; both accept the same open prompt value and POST the identical amazon_bedrock params.
signalwire.relay.call.Call.on: TS on(event, handler) types handler as the plain callback (event) => void; Python wraps it in an EventHandler class. Same subscription; EventHandler is a Python-internal wrapper.
signalwire.relay.client.RelayClient.on_call: TS onCall(handler) types handler as (call) => void and returns void; Python's CallHandler is a Python-internal wrapper class returned for decorator use. Same registration.
signalwire.relay.client.RelayClient.on_message: TS onMessage(handler) types handler as (message) => void and returns void; Python's MessageHandler is a Python-internal wrapper. Same registration.

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
signalwire.skills.claude_skills.skill.ClaudeSkillsSkill.get_parameter_schema: reference-oracle gap: the Python signatures oracle records no class for this skill module, so the port's static get_parameter_schema accessor has no reference method to compare (same shape as the SwmlTransferSkill.get_parameter_schema entry already carried).
signalwire.skills.datasphere.skill.DataSphereSkill.get_parameter_schema: reference-oracle gap: the Python signatures oracle records no class for this skill module, so the port's static get_parameter_schema accessor has no reference method to compare (same shape as the SwmlTransferSkill.get_parameter_schema entry already carried).
signalwire.skills.datasphere_serverless.skill.DataSphereServerlessSkill.get_parameter_schema: reference-oracle gap: the Python signatures oracle records no class for this skill module, so the port's static get_parameter_schema accessor has no reference method to compare (same shape as the SwmlTransferSkill.get_parameter_schema entry already carried).
signalwire.skills.datetime.skill.DateTimeSkill.get_parameter_schema: reference-oracle gap: the Python signatures oracle records no class for this skill module, so the port's static get_parameter_schema accessor has no reference method to compare (same shape as the SwmlTransferSkill.get_parameter_schema entry already carried).
signalwire.skills.google_maps.skill.GoogleMapsSkill.get_parameter_schema: reference-oracle gap: the Python signatures oracle records no class for this skill module, so the port's static get_parameter_schema accessor has no reference method to compare (same shape as the SwmlTransferSkill.get_parameter_schema entry already carried).
signalwire.skills.info_gatherer.skill.InfoGathererSkill.get_parameter_schema: reference-oracle gap: the Python signatures oracle records no class for this skill module, so the port's static get_parameter_schema accessor has no reference method to compare (same shape as the SwmlTransferSkill.get_parameter_schema entry already carried).
signalwire.skills.joke.skill.JokeSkill.get_parameter_schema: reference-oracle gap: the Python signatures oracle records no class for this skill module, so the port's static get_parameter_schema accessor has no reference method to compare (same shape as the SwmlTransferSkill.get_parameter_schema entry already carried).
signalwire.skills.math.skill.MathSkill.get_parameter_schema: reference-oracle gap: the Python signatures oracle records no class for this skill module, so the port's static get_parameter_schema accessor has no reference method to compare (same shape as the SwmlTransferSkill.get_parameter_schema entry already carried).
signalwire.skills.native_vector_search.skill.NativeVectorSearchSkill.get_parameter_schema: reference-oracle gap: the Python signatures oracle records no class for this skill module, so the port's static get_parameter_schema accessor has no reference method to compare (same shape as the SwmlTransferSkill.get_parameter_schema entry already carried).
signalwire.skills.play_background_file.skill.PlayBackgroundFileSkill.get_parameter_schema: reference-oracle gap: the Python signatures oracle records no class for this skill module, so the port's static get_parameter_schema accessor has no reference method to compare (same shape as the SwmlTransferSkill.get_parameter_schema entry already carried).
signalwire.skills.spider.skill.SpiderSkill.get_parameter_schema: reference-oracle gap: the Python signatures oracle records no class for this skill module, so the port's static get_parameter_schema accessor has no reference method to compare (same shape as the SwmlTransferSkill.get_parameter_schema entry already carried).
signalwire.skills.weather_api.skill.WeatherApiSkill.get_parameter_schema: reference-oracle gap: the Python signatures oracle records no class for this skill module, so the port's static get_parameter_schema accessor has no reference method to compare (same shape as the SwmlTransferSkill.get_parameter_schema entry already carried).
signalwire.skills.web_search.skill.WebSearchSkill.get_parameter_schema: reference-oracle gap: the Python signatures oracle records no class for this skill module, so the port's static get_parameter_schema accessor has no reference method to compare (same shape as the SwmlTransferSkill.get_parameter_schema entry already carried).
signalwire.skills.wikipedia_search.skill.WikipediaSearchSkill.get_parameter_schema: reference-oracle gap: the Python signatures oracle records no class for this skill module, so the port's static get_parameter_schema accessor has no reference method to compare (same shape as the SwmlTransferSkill.get_parameter_schema entry already carried).

## Port additions / co-location: in port, not in the signatures oracle

signalwire.cli.agent_loader.list_agents: TS-only CLI helper (offline agent loader for swaig-test); no Python equivalent in the signatures oracle.
signalwire.cli.agent_loader.load_agent: TS-only CLI helper (offline agent loader for swaig-test); no Python equivalent.
signalwire.cli.mock_data.generate_fake_post_data: TS-only CLI helper (swaig-test mock POST data); no Python equivalent.
signalwire.cli.mock_data.generate_minimal_post_data: TS-only CLI helper (swaig-test mock POST data); no Python equivalent.
signalwire.core.agent.tools.type_inference.create_typed_handler_wrapper: TS-only tool-typing helper; no Python signatures-oracle equivalent (Python's type inference is runtime-introspection based).
signalwire.core.agent.tools.type_inference.infer_schema: TS-only tool-typing helper (compile-time schema inference); no Python signatures-oracle equivalent.
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

signalwire.rest.namespaces.calling_resources_generated.Calling.live_transcribe: `action` param — flat `union<LiveTranscribeStartAction,LiveTranscribeSummarizeAction,LiveTranscribeStopAction>` vs the reference's right-nested griffe rendering of the same three-variant `anyOf`. Identical wire contract.
signalwire.rest.namespaces.calling_resources_generated.Calling.live_translate: `action` param — flat union of the four LiveTranslate*Action variants vs the reference's right-nested griffe rendering of the same `anyOf`. Identical wire contract.

## Surface-reconciled symbols: signature-shape / projection divergences

These symbols are reconciled to PRESENT in the surface audit (idiom-mapped in the
enumerators so they compare equal by name); the signature-level divergence below is
the residual idiom difference (TS declaration-merge / projection / callback shape),
not a functional gap.

signalwire.core.agent.tools.registry.ToolRegistry.__init__: idiom: TS has no ToolRegistry class to construct (the registry is a `toolRegistry` Map folded onto SWMLService); the class is surfaced by projection, so Python's constructor has no TS counterpart signature
signalwire.core.mixins.mcp_server_mixin.MCPServerMixin.add_mcp_server: idiom: reference MCPServerMixin is an empty class; TS folds MCP helpers onto AgentBase and the signatures enumerator projects add_mcp_server onto the mixin — a port-only projection with no reference method
signalwire.core.mixins.prompt_mixin.PromptMixin.contexts: idiom: Python exposes `contexts` as a property on the mixin; TS surfaces the same capability via AgentBase/PromptManager.getContexts() (get_contexts), reconciled by name in the surface audit
signalwire.core.mixins.serverless_mixin.ServerlessMixin.handle_serverless_request: idiom: TS expresses this as AgentBase.runServerless() (reconciled by name to handle_serverless_request in the surface audit); the signature shape is TS-idiomatic
signalwire.core.skill_base.SkillBase.register_tools: idiom: TS skills use the declarative getTools() contract (get_tools), reconciled by name to register_tools in the surface audit; no separate imperative register_tools method exists to sign
signalwire.core.swml_builder.SWMLBuilder.ai: idiom: SwmlBuilder installs every schema verb dynamically at construction + declares them via a generated declaration-merge interface; the config-object param shape differs from Python's positional convenience-wrapper params (same as the existing SWMLBuilder.say idiom entry)
signalwire.core.swml_builder.SWMLBuilder.answer: idiom: dynamically-installed/declaration-merged verb method; config-object param shape vs Python positional wrapper params
signalwire.core.swml_builder.SWMLBuilder.hangup: idiom: dynamically-installed/declaration-merged verb method; config-object param shape vs Python positional wrapper params
signalwire.core.swml_builder.SWMLBuilder.play: idiom: dynamically-installed/declaration-merged verb method; config-object param shape vs Python positional wrapper params
signalwire.rest._base.SignalWireRestError.body: idiom: TS exposes the parsed error body as a public property on the consolidated RestError/SignalWireRestError class; Python has no such attribute
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

signalwire.agents.bedrock.BedrockAgent.__init__: reference signatures oracle records no BedrockAgent class (present only in the surface oracle); port implements it — no reference signature to compare
signalwire.agents.bedrock.BedrockAgent.set_inference_params: reference signatures oracle records no BedrockAgent class (present only in the surface oracle); port implements it — no reference signature to compare
signalwire.agents.bedrock.BedrockAgent.set_llm_model: reference signatures oracle records no BedrockAgent class (present only in the surface oracle); port implements it — no reference signature to compare
signalwire.agents.bedrock.BedrockAgent.set_llm_temperature: reference signatures oracle records no BedrockAgent class (present only in the surface oracle); port implements it — no reference signature to compare
signalwire.agents.bedrock.BedrockAgent.set_post_prompt_llm_params: reference signatures oracle records no BedrockAgent class (present only in the surface oracle); port implements it — no reference signature to compare
signalwire.agents.bedrock.BedrockAgent.set_prompt_llm_params: reference signatures oracle records no BedrockAgent class (present only in the surface oracle); port implements it — no reference signature to compare
signalwire.agents.bedrock.BedrockAgent.set_voice: reference signatures oracle records no BedrockAgent class (present only in the surface oracle); port implements it — no reference signature to compare
