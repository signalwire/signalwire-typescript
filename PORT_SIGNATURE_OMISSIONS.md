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
signalwire.core.agent.prompt.manager.PromptManager.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.core.agent.tools.registry.ToolRegistry.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.core.agent_base.AgentBase.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.core.auth_handler.AuthHandler.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.core.config_loader.ConfigLoader.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.core.contexts.ContextBuilder.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.core.contexts.GatherInfo.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.core.contexts.GatherQuestion.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.core.function_result.FunctionResult.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
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
signalwire.livewire.AgentHandoff.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.AgentServer.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.AgentSession.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.CartesiaTTS.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.ChatContext.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.DeepgramSTT.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.ElevenLabsTTS.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.InferenceLLM.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.InferenceSTT.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.InferenceTTS.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.JobProcess.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.LLM.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.OpenAILLM.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.RunContext.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.STT.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.SileroVAD.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.StopResponse.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.TTS.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.ToolError.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.plugins.CartesiaTTS.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.plugins.DeepgramSTT.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.plugins.ElevenLabsTTS.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.plugins.OpenAILLM.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.livewire.plugins.SileroVAD.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
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
signalwire.relay.client.RelayClient.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.client.RelayError.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.CallReceiveEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.CallStateEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.CallingErrorEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.CollectEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.ConferenceEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.ConnectEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.DenoiseEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.DetectEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.DialEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.EchoEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.FaxEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.HoldEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.MessageReceiveEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.MessageStateEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.PayEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.PlayEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.QueueEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.RecordEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.ReferEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.SendDigitsEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.StreamEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.TapEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.event.TranscribeEvent.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.relay.message.Message.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest._base.HttpClient.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.base.base_resource.BaseResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.base.crud_resource.CrudResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.base.crud_with_addresses.CrudWithAddresses.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.client.RestClient.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.addresses.AddressesResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.calling.CallingNamespace.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.chat.ChatResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.compat.CompatAccounts.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.compat.CompatApplications.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.compat.CompatCalls.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.compat.CompatConferences.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.compat.CompatFaxes.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.compat.CompatLamlBins.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.compat.CompatMessages.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.compat.CompatNamespace.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.compat.CompatPhoneNumbers.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.compat.CompatQueues.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.compat.CompatRecordings.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.compat.CompatTokens.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.compat.CompatTranscriptions.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.datasphere.DatasphereDocuments.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.datasphere.DatasphereNamespace.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.fabric.CallFlowsResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.fabric.ConferenceRoomsResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.fabric.CxmlApplicationsResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.fabric.FabricAddresses.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.fabric.FabricNamespace.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.fabric.FabricResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.fabric.FabricResourcePUT.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.fabric.FabricTokens.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.fabric.GenericResources.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.fabric.SubscribersResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.imported_numbers.ImportedNumbersResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.logs.ConferenceLogs.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.logs.FaxLogs.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.logs.LogsNamespace.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.logs.MessageLogs.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.logs.VoiceLogs.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.lookup.LookupResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.mfa.MfaResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.number_groups.NumberGroupsResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.phone_numbers.PhoneNumbersResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.project.ProjectNamespace.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.project.ProjectTokens.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.pubsub.PubSubResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.queues.QueuesResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.recordings.RecordingsResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.registry.RegistryBrands.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.registry.RegistryCampaigns.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.registry.RegistryNamespace.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.registry.RegistryNumbers.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.registry.RegistryOrders.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.short_codes.ShortCodesResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.sip_profile.SipProfileResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.verified_callers.VerifiedCallersResource.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.video.VideoConferenceTokens.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.video.VideoConferences.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.video.VideoNamespace.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.video.VideoRoomRecordings.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.video.VideoRoomSessions.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.video.VideoRoomTokens.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.video.VideoRooms.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.rest.namespaces.video.VideoStreams.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.search.DocumentProcessor.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.search.IndexBuilder.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.search.SearchEngine.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.search.SearchService.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.search.search_service.SearchRequest.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.search.search_service.SearchResponse.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.search.search_service.SearchResult.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.skills.api_ninjas_trivia.skill.ApiNinjasTriviaSkill.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.skills.builtin.custom_skills.CustomSkillsSkill.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.skills.play_background_file.skill.PlayBackgroundFileSkill.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.skills.spider.skill.SpiderSkill.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.skills.weather_api.skill.WeatherApiSkill.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.utils.schema_utils.SchemaUtils.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs
signalwire.web.web_service.WebService.__init__: TS constructor signature follows TS conventions; param shape may differ from Python kwargs

## Idiom: TS fluent API returns this

signalwire.agent_server.AgentServer.get_agent: TS fluent API returns this for chaining
signalwire.agent_server.AgentServer.get_agents: TS fluent API returns this for chaining
signalwire.core.agent_base.AgentBase.add_post_ai_verb: TS fluent API returns this for chaining
signalwire.core.agent_base.AgentBase.auto_map_sip_usernames: TS fluent API returns this for chaining
signalwire.core.agent_base.AgentBase.clear_post_ai_verbs: TS fluent API returns this for chaining
signalwire.core.agent_base.AgentBase.clear_post_answer_verbs: TS fluent API returns this for chaining
signalwire.core.agent_base.AgentBase.clear_pre_answer_verbs: TS fluent API returns this for chaining
signalwire.core.agent_base.AgentBase.clear_swaig_query_params: TS fluent API returns this for chaining
signalwire.core.agent_base.AgentBase.enable_sip_routing: TS fluent API returns this for chaining
signalwire.core.agent_base.AgentBase.set_post_prompt_url: TS fluent API returns this for chaining
signalwire.core.agent_base.AgentBase.set_web_hook_url: TS fluent API returns this for chaining
signalwire.core.auth_handler.AuthHandler.get_auth_info: TS fluent API returns this for chaining
signalwire.core.contexts.Context.add_bullets: TS fluent API returns this for chaining
signalwire.core.contexts.Context.add_enter_filler: TS fluent API returns this for chaining
signalwire.core.contexts.Context.add_exit_filler: TS fluent API returns this for chaining
signalwire.core.contexts.Context.add_section: TS fluent API returns this for chaining
signalwire.core.contexts.Context.add_system_bullets: TS fluent API returns this for chaining
signalwire.core.contexts.Context.add_system_section: TS fluent API returns this for chaining
signalwire.core.contexts.Context.get_step: TS fluent API returns this for chaining
signalwire.core.contexts.Context.remove_step: TS fluent API returns this for chaining
signalwire.core.contexts.Context.set_consolidate: TS fluent API returns this for chaining
signalwire.core.contexts.Context.set_full_reset: TS fluent API returns this for chaining
signalwire.core.contexts.Context.set_initial_step: TS fluent API returns this for chaining
signalwire.core.contexts.Context.set_isolated: TS fluent API returns this for chaining
signalwire.core.contexts.Context.set_post_prompt: TS fluent API returns this for chaining
signalwire.core.contexts.Context.set_prompt: TS fluent API returns this for chaining
signalwire.core.contexts.Context.set_system_prompt: TS fluent API returns this for chaining
signalwire.core.contexts.Context.set_user_prompt: TS fluent API returns this for chaining
signalwire.core.contexts.Context.set_valid_contexts: TS fluent API returns this for chaining
signalwire.core.contexts.Context.set_valid_steps: TS fluent API returns this for chaining
signalwire.core.contexts.ContextBuilder.get_context: TS fluent API returns this for chaining
signalwire.core.contexts.ContextBuilder.reset: TS fluent API returns this for chaining
signalwire.core.contexts.Step.add_bullets: TS fluent API returns this for chaining
signalwire.core.contexts.Step.add_section: TS fluent API returns this for chaining
signalwire.core.contexts.Step.clear_sections: TS fluent API returns this for chaining
signalwire.core.contexts.Step.set_end: TS fluent API returns this for chaining
signalwire.core.contexts.Step.set_functions: TS fluent API returns this for chaining
signalwire.core.contexts.Step.set_reset_consolidate: TS fluent API returns this for chaining
signalwire.core.contexts.Step.set_reset_full_reset: TS fluent API returns this for chaining
signalwire.core.contexts.Step.set_reset_system_prompt: TS fluent API returns this for chaining
signalwire.core.contexts.Step.set_reset_user_prompt: TS fluent API returns this for chaining
signalwire.core.contexts.Step.set_skip_to_next_step: TS fluent API returns this for chaining
signalwire.core.contexts.Step.set_skip_user_turn: TS fluent API returns this for chaining
signalwire.core.contexts.Step.set_step_criteria: TS fluent API returns this for chaining
signalwire.core.contexts.Step.set_text: TS fluent API returns this for chaining
signalwire.core.contexts.Step.set_valid_contexts: TS fluent API returns this for chaining
signalwire.core.contexts.Step.set_valid_steps: TS fluent API returns this for chaining
signalwire.core.data_map.DataMap.body: TS fluent API returns this for chaining
signalwire.core.data_map.DataMap.description: TS fluent API returns this for chaining
signalwire.core.data_map.DataMap.error_keys: TS fluent API returns this for chaining
signalwire.core.data_map.DataMap.fallback_output: TS fluent API returns this for chaining
signalwire.core.data_map.DataMap.global_error_keys: TS fluent API returns this for chaining
signalwire.core.data_map.DataMap.output: TS fluent API returns this for chaining
signalwire.core.data_map.DataMap.params: TS fluent API returns this for chaining
signalwire.core.data_map.DataMap.purpose: TS fluent API returns this for chaining
signalwire.core.data_map.DataMap.webhook_expressions: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.add_action: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.add_actions: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.clear_dynamic_hints: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.create_payment_action: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.create_payment_parameter: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.enable_extensive_data: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.enable_functions_on_timeout: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.hangup: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.join_room: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.play_background_file: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.remove_global_data: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.remove_metadata: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.rpc_ai_message: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.rpc_ai_unhold: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.rpc_dial: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.say: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.set_metadata: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.set_post_process: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.set_response: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.simulate_user_input: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.sip_refer: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.stop: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.stop_background_file: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.swml_change_context: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.swml_change_step: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.swml_transfer: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.swml_user_event: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.update_global_data: TS fluent API returns this for chaining
signalwire.core.function_result.FunctionResult.update_settings: TS fluent API returns this for chaining
signalwire.core.pom_builder.PomBuilder.get_section: TS fluent API returns this for chaining
signalwire.core.pom_builder.PomBuilder.to_dict: TS fluent API returns this for chaining
signalwire.core.security.session_manager.SessionManager.debug_token: TS fluent API returns this for chaining
signalwire.core.skill_base.SkillBase.get_prompt_sections: TS fluent API returns this for chaining
signalwire.core.swml_builder.SWMLBuilder.add_section: TS fluent API returns this for chaining
signalwire.core.swml_builder.SWMLBuilder.reset: TS fluent API returns this for chaining
signalwire.core.swml_handler.VerbHandlerRegistry.get_handler: TS fluent API returns this for chaining
signalwire.core.swml_service.SWMLService.as_router: TS fluent API returns this for chaining
signalwire.skills.registry.SkillRegistry.list_skills: TS fluent API returns this for chaining

## Backlog: real signature divergences (754 symbols)

Real TS port maintenance — parameter renames, missing optionals,
type imprecisions. Triage in a separate sweep.

signalwire.add_skill_directory: BACKLOG / missing-port/ in reference, not in port
signalwire.agent_server.AgentServer.register: BACKLOG / param-mismatch/ param[2] (route)/ type 'optional<string>' vs 'string'
signalwire.agent_server.AgentServer.register_global_routing_callback: BACKLOG / param-mismatch/ param[1] (callback_fn)/ type 'callable<list<class/Request,dict<string,any>>,opti
signalwire.agent_server.AgentServer.run: BACKLOG / param-count-mismatch/ reference has 5 param(s), port has 3/ reference=['self', 'event', 'context', 'ho; return-mismatch/
signalwire.cli.agent_loader.list_agents: BACKLOG / missing-reference/ in port, not in reference
signalwire.cli.agent_loader.load_agent: BACKLOG / missing-reference/ in port, not in reference
signalwire.cli.mock_data.generate_fake_post_data: BACKLOG / missing-reference/ in port, not in reference
signalwire.cli.mock_data.generate_minimal_post_data: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent.prompt.manager.PromptManager.define_contexts: BACKLOG / missing-port/ in reference, not in port
signalwire.core.agent.prompt.manager.PromptManager.get_post_prompt: BACKLOG / return-mismatch/ returns 'optional<string>' vs 'string'
signalwire.core.agent.prompt.manager.PromptManager.get_prompt: BACKLOG / return-mismatch/ returns 'optional<union<list<dict<string,any>>,string>>' vs 'string'
signalwire.core.agent.prompt.manager.PromptManager.prompt_add_section: BACKLOG / missing-port/ in reference, not in port
signalwire.core.agent.prompt.manager.PromptManager.prompt_add_subsection: BACKLOG / missing-port/ in reference, not in port
signalwire.core.agent.prompt.manager.PromptManager.prompt_add_to_section: BACKLOG / missing-port/ in reference, not in port
signalwire.core.agent.prompt.manager.PromptManager.prompt_has_section: BACKLOG / missing-port/ in reference, not in port
signalwire.core.agent.prompt.manager.PromptManager.set_prompt_pom: BACKLOG / missing-port/ in reference, not in port
signalwire.core.agent.tools.registry.ToolRegistry.define_tool: BACKLOG / missing-port/ in reference, not in port
signalwire.core.agent.tools.type_inference.create_typed_handler_wrapper: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 3/ reference=['func', 'has_raw_data'] port=['; return-mismatch/
signalwire.core.agent.tools.type_inference.infer_schema: BACKLOG / param-mismatch/ param[0] (func)/ name 'func' vs 'fn'; type 'any' vs 'callable<list<any>,any>'; return-mismatch/ returns 
signalwire.core.agent_base.AgentBase.add_answer_verb: BACKLOG / param-mismatch/ param[1] (config)/ type 'optional<dict<string,any>>' vs 'dict<string,any>'; return-mismatch/ returns 'cl
signalwire.core.agent_base.AgentBase.add_function_include: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.add_hint: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.add_hints: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.add_internal_filler: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.add_language: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.add_mcp_server: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.add_pattern_hint: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.add_post_answer_verb: BACKLOG / param-mismatch/ param[2] (config)/ type 'dict<string,any>' vs 'union<dict<string,any>,float>'; return-mismatch/ returns 
signalwire.core.agent_base.AgentBase.add_pre_answer_verb: BACKLOG / param-mismatch/ param[2] (config)/ type 'dict<string,any>' vs 'union<dict<string,any>,float>'; return-mismatch/ returns 
signalwire.core.agent_base.AgentBase.add_pronunciation: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.add_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.add_swaig_query_params: BACKLOG / param-mismatch/ param[1] (params)/ type 'dict<string,string>' vs 'dict<string,any>'; return-mismatch/ returns 'class/sig
signalwire.core.agent_base.AgentBase.as_router: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.define_contexts: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.define_tool: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.define_tools: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.enable_debug_events: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.enable_debug_routes: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.enable_mcp_server: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.get_app: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.get_basic_auth_credentials: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.get_post_prompt: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.get_prompt: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.has_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.list_skills: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.manual_set_proxy_url: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.on_debug_event: BACKLOG / param-mismatch/ param[1] (handler)/ name 'handler' vs '_event'; type 'class/Callable' vs 'dict<s; return-mismatch/ retur
signalwire.core.agent_base.AgentBase.on_function_call: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.on_summary: BACKLOG / param-mismatch/ param[1] (summary)/ name 'summary' vs '_summary'; type 'optional<dict<string,any; param-mismatch/ param[
signalwire.core.agent_base.AgentBase.on_swml_request: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.prompt_add_section: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.prompt_add_subsection: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.prompt_add_to_section: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.prompt_has_section: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.register_routing_callback: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.register_sip_username: BACKLOG / param-mismatch/ param[1] (sip_username)/ name 'sip_username' vs 'username'; return-mismatch/ returns 'class/signalwire.c
signalwire.core.agent_base.AgentBase.remove_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.reset_contexts: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.run: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.serve: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.set_dynamic_config_callback: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.set_function_includes: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.set_global_data: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.set_internal_fillers: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.set_languages: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.set_native_functions: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.set_param: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.set_params: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.set_post_prompt: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.set_post_prompt_llm_params: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.set_prompt_llm_params: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.set_prompt_pom: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.set_prompt_text: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.set_pronunciations: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.setup_graceful_shutdown: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.update_global_data: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.validate_basic_auth: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.agent_base.AgentBase.validate_tool_token: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.auth_handler.AuthHandler.verify_api_key: BACKLOG / param-mismatch/ param[1] (api_key)/ name 'api_key' vs 'key'
signalwire.core.auth_handler.AuthHandler.verify_basic_auth: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 3/ reference=['self', 'credentials'] port=['s
signalwire.core.auth_handler.AuthHandler.verify_bearer_token: BACKLOG / param-mismatch/ param[1] (credentials)/ name 'credentials' vs 'token'; type 'class/HTTPAuthoriza
signalwire.core.config_loader.ConfigLoader.find_config_file: BACKLOG / param-mismatch/ param[0] (service_name)/ type 'optional<string>' vs 'string'; param-mismatch/ param[1] (additional_paths
signalwire.core.config_loader.ConfigLoader.get: BACKLOG / param-mismatch/ param[1] (key_path)/ name 'key_path' vs 'path'; param-mismatch/ param[2] (default)/ name 'default' vs 'd
signalwire.core.config_loader.ConfigLoader.get_config_file: BACKLOG / return-mismatch/ returns 'optional<string>' vs 'string'
signalwire.core.config_loader.ConfigLoader.substitute_vars: BACKLOG / param-mismatch/ param[2] (max_depth)/ type 'int' vs 'float'
signalwire.core.contexts.Context.add_step: BACKLOG / param-count-mismatch/ reference has 7 param(s), port has 3/ reference=['self', 'name', 'task', 'bullet
signalwire.core.contexts.Context.move_step: BACKLOG / param-mismatch/ param[2] (position)/ type 'int' vs 'float'; return-mismatch/ returns 'class/signalwire.core.contexts.Con
signalwire.core.contexts.Context.set_enter_fillers: BACKLOG / param-mismatch/ param[1] (enter_fillers)/ name 'enter_fillers' vs 'fillers'; type 'dict<string,l; return-mismatch/ retur
signalwire.core.contexts.Context.set_exit_fillers: BACKLOG / param-mismatch/ param[1] (exit_fillers)/ name 'exit_fillers' vs 'fillers'; type 'dict<string,lis; return-mismatch/ retur
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
signalwire.core.function_result.FunctionResult.connect: BACKLOG / param-mismatch/ param[3] (from_addr)/ type 'optional<string>' vs 'string'; return-mismatch/ returns 'class/signalwire.co
signalwire.core.function_result.FunctionResult.create_payment_prompt: BACKLOG / param-mismatch/ param[1] (actions)/ type 'list<dict<string,string>>' vs 'list<class/signalwire.c; param-mismatch/ param[
signalwire.core.function_result.FunctionResult.execute_rpc: BACKLOG / param-count-mismatch/ reference has 5 param(s), port has 2/ reference=['self', 'method', 'params', 'ca; return-mismatch/
signalwire.core.function_result.FunctionResult.execute_swml: BACKLOG / param-mismatch/ param[1] (swml_content)/ type 'any' vs 'union<class/signalwire.core.function_res; return-mismatch/ retur
signalwire.core.function_result.FunctionResult.hold: BACKLOG / param-mismatch/ param[1] (timeout)/ type 'int' vs 'float'; return-mismatch/ returns 'class/signalwire.core.function_resu
signalwire.core.function_result.FunctionResult.join_conference: BACKLOG / param-count-mismatch/ reference has 19 param(s), port has 3/ reference=['self', 'name', 'muted', 'beep; return-mismatch/
signalwire.core.function_result.FunctionResult.pay: BACKLOG / param-count-mismatch/ reference has 20 param(s), port has 2/ reference=['self', 'payment_connector_url; return-mismatch/
signalwire.core.function_result.FunctionResult.record_call: BACKLOG / param-count-mismatch/ reference has 12 param(s), port has 2/ reference=['self', 'control_id', 'stereo'; return-mismatch/
signalwire.core.function_result.FunctionResult.replace_in_history: BACKLOG / param-mismatch/ param[1] (text)/ type 'union<bool,string>' vs 'union<bool,bool,string>'; return-mismatch/ returns 'class
signalwire.core.function_result.FunctionResult.send_sms: BACKLOG / param-count-mismatch/ reference has 7 param(s), port has 2/ reference=['self', 'to_number', 'from_numb; return-mismatch/
signalwire.core.function_result.FunctionResult.set_end_of_speech_timeout: BACKLOG / param-mismatch/ param[1] (milliseconds)/ type 'int' vs 'float'; return-mismatch/ returns 'class/signalwire.core.function
signalwire.core.function_result.FunctionResult.set_speech_event_timeout: BACKLOG / param-mismatch/ param[1] (milliseconds)/ type 'int' vs 'float'; return-mismatch/ returns 'class/signalwire.core.function
signalwire.core.function_result.FunctionResult.stop_record_call: BACKLOG / param-mismatch/ param[1] (control_id)/ type 'optional<string>' vs 'string'; return-mismatch/ returns 'class/signalwire.c
signalwire.core.function_result.FunctionResult.stop_tap: BACKLOG / param-mismatch/ param[1] (control_id)/ type 'optional<string>' vs 'string'; return-mismatch/ returns 'class/signalwire.c
signalwire.core.function_result.FunctionResult.switch_context: BACKLOG / param-count-mismatch/ reference has 5 param(s), port has 2/ reference=['self', 'system_prompt', 'user_; return-mismatch/
signalwire.core.function_result.FunctionResult.tap: BACKLOG / param-count-mismatch/ reference has 7 param(s), port has 2/ reference=['self', 'uri', 'control_id', 'd; return-mismatch/
signalwire.core.function_result.FunctionResult.toggle_functions: BACKLOG / param-mismatch/ param[1] (function_toggles)/ name 'function_toggles' vs 'toggles'; type 'list<di; return-mismatch/ retur
signalwire.core.function_result.FunctionResult.wait_for_user: BACKLOG / param-count-mismatch/ reference has 4 param(s), port has 2/ reference=['self', 'enabled', 'timeout', '; return-mismatch/
signalwire.core.logging_config.get_execution_mode: BACKLOG / return-mismatch/ returns 'any' vs 'tuple<string,union<string,string,string>>'
signalwire.core.logging_config.get_logger: BACKLOG / param-mismatch/ param[0] (name)/ type 'any' vs 'string'; return-mismatch/ returns 'any' vs 'class/signalwire.core.loggin
signalwire.core.logging_config.reset_logging_configuration: BACKLOG / return-mismatch/ returns 'any' vs 'void'
signalwire.core.logging_config.strip_control_chars: BACKLOG / param-count-mismatch/ reference has 3 param(s), port has 1/ reference=['logger', 'method_name', 'event
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.add_function_include: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.add_hint: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.add_hints: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.add_internal_filler: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.add_language: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.add_mcp_server: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.add_pattern_hint: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.add_pronunciation: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.enable_debug_events: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.enable_mcp_server: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.set_function_includes: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.set_global_data: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.set_internal_fillers: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.set_languages: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.set_native_functions: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.set_param: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.set_params: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.set_post_prompt_llm_params: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.set_prompt_llm_params: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.set_pronunciations: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.ai_config_mixin.AIConfigMixin.update_global_data: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.auth_mixin.AuthMixin.get_basic_auth_credentials: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.auth_mixin.AuthMixin.validate_basic_auth: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.prompt_mixin.PromptMixin.define_contexts: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.prompt_mixin.PromptMixin.get_post_prompt: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.prompt_mixin.PromptMixin.get_prompt: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.prompt_mixin.PromptMixin.prompt_add_section: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.prompt_mixin.PromptMixin.prompt_add_subsection: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.prompt_mixin.PromptMixin.prompt_add_to_section: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.prompt_mixin.PromptMixin.prompt_has_section: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.prompt_mixin.PromptMixin.reset_contexts: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.prompt_mixin.PromptMixin.set_post_prompt: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.prompt_mixin.PromptMixin.set_prompt_pom: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.prompt_mixin.PromptMixin.set_prompt_text: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.skill_mixin.SkillMixin.add_skill: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.skill_mixin.SkillMixin.has_skill: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.skill_mixin.SkillMixin.list_skills: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.skill_mixin.SkillMixin.remove_skill: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.state_mixin.StateMixin.validate_tool_token: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.tool_mixin.ToolMixin.define_tool: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.tool_mixin.ToolMixin.define_tools: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.tool_mixin.ToolMixin.on_function_call: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.web_mixin.WebMixin.as_router: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.web_mixin.WebMixin.enable_debug_routes: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.web_mixin.WebMixin.get_app: BACKLOG / missing-port/ in reference, not in port
signalwire.core.mixins.web_mixin.WebMixin.manual_set_proxy_url: BACKLOG / missing-port/ in reference, not in port
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
signalwire.core.security.session_manager.SessionManager.activate_session: BACKLOG / param-mismatch/ param[1] (call_id)/ name 'call_id' vs '_call_id'
signalwire.core.security.session_manager.SessionManager.create_session: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'optional<string>' vs 'string'
signalwire.core.security.session_manager.SessionManager.end_session: BACKLOG / param-mismatch/ param[1] (call_id)/ name 'call_id' vs '_call_id'
signalwire.core.security.session_manager.SessionManager.get_session_metadata: BACKLOG / param-mismatch/ param[1] (call_id)/ name 'call_id' vs 'session_id'; return-mismatch/ returns 'optional<dict<string,any>>
signalwire.core.security.session_manager.SessionManager.set_session_metadata: BACKLOG / param-count-mismatch/ reference has 4 param(s), port has 3/ reference=['self', 'call_id', 'key', 'valu; return-mismatch/
signalwire.core.security_config.SecurityConfig.get_basic_auth: BACKLOG / missing-port/ in reference, not in port
signalwire.core.security_config.SecurityConfig.validate_ssl_config: BACKLOG / missing-port/ in reference, not in port
signalwire.core.skill_base.SkillBase.define_tool: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'tool_def'; kind 'var_keyword' vs 'positiona
signalwire.core.skill_base.SkillBase.get_parameter_schema: BACKLOG / param-count-mismatch/ reference has 1 param(s), port has 0/ reference=['cls'] port=[]; return-mismatch/ returns 'dict<st
signalwire.core.skill_base.SkillBase.validate_env_vars: BACKLOG / return-mismatch/ returns 'bool' vs 'list<string>'
signalwire.core.skill_base.SkillBase.validate_packages: BACKLOG / return-mismatch/ returns 'bool' vs 'list<string>'
signalwire.core.skill_manager.SkillManager.add_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.skill_manager.SkillManager.get_skill: BACKLOG / param-mismatch/ param[1] (skill_identifier)/ name 'skill_identifier' vs 'key_or_id'; return-mismatch/ returns 'optional<
signalwire.core.skill_manager.SkillManager.has_skill: BACKLOG / param-mismatch/ param[1] (skill_identifier)/ name 'skill_identifier' vs 'skill_name'
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
signalwire.core.swml_handler.SWMLVerbHandler.build_config: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'opts'; kind 'var_keyword' vs 'positional'; 
signalwire.core.swml_service.SWMLService.add_section: BACKLOG / return-mismatch/ returns 'bool' vs 'any'
signalwire.core.swml_service.SWMLService.add_verb: BACKLOG / param-mismatch/ param[1] (verb_name)/ name 'verb_name' vs 'name'; param-mismatch/ param[2] (config)/ type 'union<dict<st
signalwire.core.swml_service.SWMLService.add_verb_to_section: BACKLOG / param-mismatch/ param[3] (config)/ type 'union<dict<string,any>,int>' vs 'any'; return-mismatch/ returns 'bool' vs 'any'
signalwire.core.swml_service.SWMLService.extract_sip_username: BACKLOG / return-mismatch/ returns 'optional<string>' vs 'string'
signalwire.core.swml_service.SWMLService.full_validation_enabled: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.swml_service.SWMLService.get_basic_auth_credentials: BACKLOG / param-mismatch/ param[1] (include_source)/ default False vs None; return-mismatch/ returns 'union<tuple<string,string,st
signalwire.core.swml_service.SWMLService.manual_set_proxy_url: BACKLOG / param-mismatch/ param[1] (proxy_url)/ name 'proxy_url' vs 'url'; return-mismatch/ returns 'void' vs 'any'
signalwire.core.swml_service.SWMLService.on_request: BACKLOG / param-count-mismatch/ reference has 3 param(s), port has 5/ reference=['self', 'request_data', 'callba; return-mismatch/
signalwire.core.swml_service.SWMLService.register_routing_callback: BACKLOG / param-mismatch/ param[1] (callback_fn)/ type 'callable<list<class/Request,dict<string,any>>,opti
signalwire.core.swml_service.SWMLService.register_verb_handler: BACKLOG / param-mismatch/ param[1] (handler)/ type 'class/signalwire.core.swml_handler.SWMLVerbHandler' vs
signalwire.core.swml_service.SWMLService.reset_document: BACKLOG / return-mismatch/ returns 'void' vs 'any'
signalwire.core.swml_service.SWMLService.serve: BACKLOG / param-count-mismatch/ reference has 7 param(s), port has 2/ reference=['self', 'host', 'port', 'ssl_ce
signalwire.core.swml_service.SecurityConfig.get_basic_auth: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.swml_service.SecurityConfig.validate_ssl_config: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.swml_service.VerbHandlerRegistry.get_handler: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.swml_service.VerbHandlerRegistry.has_handler: BACKLOG / missing-reference/ in port, not in reference
signalwire.core.swml_service.VerbHandlerRegistry.register_handler: BACKLOG / missing-reference/ in port, not in reference
signalwire.index.add_skill_directory: BACKLOG / missing-reference/ in port, not in reference
signalwire.index.list_skills: BACKLOG / missing-reference/ in port, not in reference
signalwire.index.list_skills_with_params: BACKLOG / missing-reference/ in port, not in reference
signalwire.index.register_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.index.run_agent: BACKLOG / missing-reference/ in port, not in reference
signalwire.index.start_agent: BACKLOG / missing-reference/ in port, not in reference
signalwire.list_skills: BACKLOG / missing-port/ in reference, not in port
signalwire.list_skills_with_params: BACKLOG / missing-port/ in reference, not in port
signalwire.livewire.Agent.llm_node: BACKLOG / param-mismatch/ param[1] (chat_ctx)/ name 'chat_ctx' vs '_chat_ctx'; param-mismatch/ param[2] (tools)/ name 'tools' vs '
signalwire.livewire.Agent.on_enter: BACKLOG / return-mismatch/ returns 'any' vs 'void'
signalwire.livewire.Agent.on_exit: BACKLOG / return-mismatch/ returns 'any' vs 'void'
signalwire.livewire.Agent.on_user_turn_completed: BACKLOG / param-mismatch/ param[1] (turn_ctx)/ name 'turn_ctx' vs '_turn_ctx'; param-mismatch/ param[2] (new_message)/ name 'new_m
signalwire.livewire.Agent.session: BACKLOG / missing-reference/ in port, not in reference
signalwire.livewire.Agent.stt_node: BACKLOG / param-mismatch/ param[1] (audio)/ name 'audio' vs '_audio'; param-mismatch/ param[2] (model_settings)/ name 'model_setti
signalwire.livewire.Agent.tts_node: BACKLOG / param-mismatch/ param[1] (text)/ name 'text' vs '_text'; param-mismatch/ param[2] (model_settings)/ name 'model_settings
signalwire.livewire.Agent.update_instructions: BACKLOG / return-mismatch/ returns 'any' vs 'void'
signalwire.livewire.Agent.update_tools: BACKLOG / param-mismatch/ param[1] (tools)/ type 'list<any>' vs 'list<class/signalwire.livewire.FunctionTo; return-mismatch/ retur
signalwire.livewire.AgentServer.rtc_session: BACKLOG / param-count-mismatch/ reference has 6 param(s), port has 3/ reference=['self', 'func', 'agent_name', '; return-mismatch/
signalwire.livewire.AgentSession.generate_reply: BACKLOG / param-mismatch/ param[1] (instructions)/ name 'instructions' vs 'options'; kind 'keyword' vs 'po; return-mismatch/ retur
signalwire.livewire.AgentSession.history: BACKLOG / missing-reference/ in port, not in reference
signalwire.livewire.AgentSession.interrupt: BACKLOG / return-mismatch/ returns 'any' vs 'void'
signalwire.livewire.AgentSession.say: BACKLOG / return-mismatch/ returns 'any' vs 'void'
signalwire.livewire.AgentSession.start: BACKLOG / param-count-mismatch/ reference has 4 param(s), port has 2/ reference=['self', 'agent', 'room', 'recor; return-mismatch/
signalwire.livewire.AgentSession.update_agent: BACKLOG / return-mismatch/ returns 'any' vs 'void'
signalwire.livewire.AgentSession.user_data: BACKLOG / missing-reference/ in port, not in reference
signalwire.livewire.ChatContext.append: BACKLOG / param-count-mismatch/ reference has 3 param(s), port has 2/ reference=['self', 'role', 'text'] port=['
signalwire.livewire.JobContext.connect: BACKLOG / return-mismatch/ returns 'any' vs 'void'
signalwire.livewire.JobContext.wait_for_participant: BACKLOG / param-mismatch/ param[1] (identity)/ name 'identity' vs 'options'; kind 'keyword' vs 'positional
signalwire.livewire.RunContext.user_data: BACKLOG / missing-reference/ in port, not in reference
signalwire.livewire.SileroVAD.load: BACKLOG / missing-reference/ in port, not in reference
signalwire.livewire.function_tool: BACKLOG / missing-port/ in reference, not in port
signalwire.livewire.plugins.SileroVAD.load: BACKLOG / missing-port/ in reference, not in port
signalwire.livewire.run_app: BACKLOG / param-mismatch/ param[0] (server)/ name 'server' vs 'options'; type 'class/signalwire.livewire.A; return-mismatch/ retur
signalwire.livewire.tool: BACKLOG / missing-reference/ in port, not in reference
signalwire.prefabs.concierge.ConciergeAgent.on_summary: BACKLOG / param-mismatch/ param[1] (summary)/ type 'any' vs 'dict<string,any>'; param-mismatch/ param[2] (raw_data)/ name 'raw_dat
signalwire.prefabs.faq_bot.FAQBotAgent.on_summary: BACKLOG / param-mismatch/ param[1] (summary)/ type 'any' vs 'dict<string,any>'; param-mismatch/ param[2] (raw_data)/ name 'raw_dat
signalwire.prefabs.info_gatherer.InfoGathererAgent.on_swml_request: BACKLOG / param-count-mismatch/ reference has 4 param(s), port has 2/ reference=['self', 'request_data', 'callba; return-mismatch/
signalwire.prefabs.info_gatherer.InfoGathererAgent.set_question_callback: BACKLOG / param-mismatch/ param[1] (callback)/ type 'callable<list<dict<any,any>,dict<any,any>,dict<any,an
signalwire.prefabs.receptionist.ReceptionistAgent.on_summary: BACKLOG / param-mismatch/ param[1] (summary)/ name 'summary' vs '_summary'; type 'any' vs 'dict<string,any; param-mismatch/ param[
signalwire.prefabs.survey.SurveyAgent.on_summary: BACKLOG / param-mismatch/ param[1] (summary)/ type 'any' vs 'union<dict<string,any>,string>'; param-mismatch/ param[2] (raw_data)/
signalwire.register_skill: BACKLOG / missing-port/ in reference, not in port
signalwire.relay.call.AIAction.stop: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.Action.is_done: BACKLOG / missing-reference/ in port, not in reference
signalwire.relay.call.Action.wait: BACKLOG / param-mismatch/ param[1] (timeout)/ type 'optional<float>' vs 'float'
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
signalwire.relay.call.Call.disconnect: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.Call.echo: BACKLOG / param-count-mismatch/ reference has 4 param(s), port has 2/ reference=['self', 'timeout', 'status_url'; return-mismatch/
signalwire.relay.call.Call.hangup: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.Call.hold: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
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
signalwire.relay.call.Call.unhold: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.Call.user_event: BACKLOG / param-count-mismatch/ reference has 3 param(s), port has 2/ reference=['self', 'event', 'kwargs'] port; return-mismatch/
signalwire.relay.call.Call.wait_for: BACKLOG / param-mismatch/ param[2] (predicate)/ type 'optional<callable<list<class/signalwire.relay.event.; param-mismatch/ param[
signalwire.relay.call.Call.wait_for_ended: BACKLOG / param-mismatch/ param[1] (timeout)/ type 'optional<float>' vs 'float'
signalwire.relay.call.CollectAction.start_input_timers: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.CollectAction.stop: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.CollectAction.volume: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.DetectAction.stop: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.call.FaxAction.stop: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
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
signalwire.relay.call.TranscribeAction.stop: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.client.RelayClient.dial: BACKLOG / param-count-mismatch/ reference has 5 param(s), port has 3/ reference=['self', 'devices', 'tag', 'max_
signalwire.relay.client.RelayClient.execute: BACKLOG / return-mismatch/ returns 'dict<any,any>' vs 'dict<string,any>'
signalwire.relay.client.RelayClient.on_call: BACKLOG / param-mismatch/ param[1] (handler)/ type 'class/signalwire.relay.client.CallHandler' vs 'callabl; return-mismatch/ retur
signalwire.relay.client.RelayClient.on_message: BACKLOG / param-mismatch/ param[1] (handler)/ type 'class/signalwire.relay.client.MessageHandler' vs 'call; return-mismatch/ retur
signalwire.relay.client.RelayClient.relay_protocol: BACKLOG / missing-reference/ in port, not in reference
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
signalwire.relay.message.Message.is_done: BACKLOG / missing-reference/ in port, not in reference
signalwire.relay.message.Message.on: BACKLOG / param-mismatch/ param[1] (handler)/ type 'class/Callable' vs 'callable<list<class/signalwire.rel
signalwire.relay.message.Message.result: BACKLOG / missing-reference/ in port, not in reference
signalwire.relay.message.Message.wait: BACKLOG / param-mismatch/ param[1] (timeout)/ type 'optional<float>' vs 'float'
signalwire.rest._base.HttpClient.delete: BACKLOG / missing-reference/ in port, not in reference
signalwire.rest._base.HttpClient.get: BACKLOG / missing-reference/ in port, not in reference
signalwire.rest._base.HttpClient.patch: BACKLOG / missing-reference/ in port, not in reference
signalwire.rest._base.HttpClient.post: BACKLOG / missing-reference/ in port, not in reference
signalwire.rest._base.HttpClient.put: BACKLOG / missing-reference/ in port, not in reference
signalwire.rest.base.crud_resource.CrudResource.create: BACKLOG / missing-reference/ in port, not in reference
signalwire.rest.base.crud_resource.CrudResource.delete: BACKLOG / missing-reference/ in port, not in reference
signalwire.rest.base.crud_resource.CrudResource.get: BACKLOG / missing-reference/ in port, not in reference
signalwire.rest.base.crud_resource.CrudResource.list: BACKLOG / missing-reference/ in port, not in reference
signalwire.rest.base.crud_resource.CrudResource.update: BACKLOG / missing-reference/ in port, not in reference
signalwire.rest.base.crud_with_addresses.CrudWithAddresses.list_addresses: BACKLOG / missing-reference/ in port, not in reference
signalwire.rest.namespaces.addresses.AddressesResource.create: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.addresses.AddressesResource.delete: BACKLOG / param-mismatch/ param[1] (address_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.addresses.AddressesResource.get: BACKLOG / param-mismatch/ param[1] (address_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.addresses.AddressesResource.list: BACKLOG / param-mismatch/ param[1] (params)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<strin
signalwire.rest.namespaces.calling.CallingNamespace.ai_hold: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.ai_message: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.ai_stop: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.ai_unhold: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.collect: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.collect_start_input_timers: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.collect_stop: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.denoise: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.denoise_stop: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.detect: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.detect_stop: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.dial: BACKLOG / param-mismatch/ param[1] (params)/ kind 'var_keyword' vs 'positional'
signalwire.rest.namespaces.calling.CallingNamespace.disconnect: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.end: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.live_transcribe: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.live_translate: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.play: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.play_pause: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.play_resume: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.play_stop: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.play_volume: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.receive_fax_stop: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.record: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.record_pause: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.record_resume: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.record_stop: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.refer: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.send_fax_stop: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.stream: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.stream_stop: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.tap: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.tap_stop: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.transcribe: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.transcribe_stop: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.transfer: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.calling.CallingNamespace.update: BACKLOG / param-mismatch/ param[1] (params)/ kind 'var_keyword' vs 'positional'
signalwire.rest.namespaces.calling.CallingNamespace.user_event: BACKLOG / param-mismatch/ param[1] (call_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.chat.ChatResource.create_token: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.compat.CompatAccounts.create: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.compat.CompatAccounts.get: BACKLOG / param-mismatch/ param[1] (sid)/ type 'any' vs 'string'
signalwire.rest.namespaces.compat.CompatAccounts.list: BACKLOG / param-mismatch/ param[1] (params)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<strin
signalwire.rest.namespaces.compat.CompatAccounts.update: BACKLOG / param-mismatch/ param[1] (sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body'; kind
signalwire.rest.namespaces.compat.CompatApplications.update: BACKLOG / param-mismatch/ param[1] (sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body'; kind
signalwire.rest.namespaces.compat.CompatCalls.start_recording: BACKLOG / param-mismatch/ param[1] (call_sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body';
signalwire.rest.namespaces.compat.CompatCalls.start_stream: BACKLOG / param-mismatch/ param[1] (call_sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body';
signalwire.rest.namespaces.compat.CompatCalls.stop_stream: BACKLOG / param-mismatch/ param[1] (call_sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (stream_sid)/ type 'any' vs 'strin
signalwire.rest.namespaces.compat.CompatCalls.update: BACKLOG / param-mismatch/ param[1] (sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body'; kind
signalwire.rest.namespaces.compat.CompatCalls.update_recording: BACKLOG / param-mismatch/ param[1] (call_sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (recording_sid)/ type 'any' vs 'st
signalwire.rest.namespaces.compat.CompatConferences.delete_recording: BACKLOG / param-mismatch/ param[1] (conference_sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (recording_sid)/ type 'any' 
signalwire.rest.namespaces.compat.CompatConferences.get: BACKLOG / param-mismatch/ param[1] (sid)/ type 'any' vs 'string'
signalwire.rest.namespaces.compat.CompatConferences.get_participant: BACKLOG / param-mismatch/ param[1] (conference_sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (call_sid)/ type 'any' vs 's
signalwire.rest.namespaces.compat.CompatConferences.get_recording: BACKLOG / param-mismatch/ param[1] (conference_sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (recording_sid)/ type 'any' 
signalwire.rest.namespaces.compat.CompatConferences.list: BACKLOG / param-mismatch/ param[1] (params)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<strin
signalwire.rest.namespaces.compat.CompatConferences.list_participants: BACKLOG / param-mismatch/ param[1] (conference_sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword'
signalwire.rest.namespaces.compat.CompatConferences.list_recordings: BACKLOG / param-mismatch/ param[1] (conference_sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword'
signalwire.rest.namespaces.compat.CompatConferences.remove_participant: BACKLOG / param-mismatch/ param[1] (conference_sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (call_sid)/ type 'any' vs 's
signalwire.rest.namespaces.compat.CompatConferences.start_stream: BACKLOG / param-mismatch/ param[1] (conference_sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs '
signalwire.rest.namespaces.compat.CompatConferences.stop_stream: BACKLOG / param-mismatch/ param[1] (conference_sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (stream_sid)/ type 'any' vs 
signalwire.rest.namespaces.compat.CompatConferences.update: BACKLOG / param-mismatch/ param[1] (sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body'; kind
signalwire.rest.namespaces.compat.CompatConferences.update_participant: BACKLOG / param-mismatch/ param[1] (conference_sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (call_sid)/ type 'any' vs 's
signalwire.rest.namespaces.compat.CompatConferences.update_recording: BACKLOG / param-mismatch/ param[1] (conference_sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (recording_sid)/ type 'any' 
signalwire.rest.namespaces.compat.CompatFaxes.delete_media: BACKLOG / param-mismatch/ param[1] (fax_sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (media_sid)/ type 'any' vs 'string'
signalwire.rest.namespaces.compat.CompatFaxes.get_media: BACKLOG / param-mismatch/ param[1] (fax_sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (media_sid)/ type 'any' vs 'string'
signalwire.rest.namespaces.compat.CompatFaxes.list_media: BACKLOG / param-mismatch/ param[1] (fax_sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.compat.CompatFaxes.update: BACKLOG / param-mismatch/ param[1] (sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body'; kind
signalwire.rest.namespaces.compat.CompatLamlBins.update: BACKLOG / param-mismatch/ param[1] (sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body'; kind
signalwire.rest.namespaces.compat.CompatMessages.delete_media: BACKLOG / param-mismatch/ param[1] (message_sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (media_sid)/ type 'any' vs 'str
signalwire.rest.namespaces.compat.CompatMessages.get_media: BACKLOG / param-mismatch/ param[1] (message_sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (media_sid)/ type 'any' vs 'str
signalwire.rest.namespaces.compat.CompatMessages.list_media: BACKLOG / param-mismatch/ param[1] (message_sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs
signalwire.rest.namespaces.compat.CompatMessages.update: BACKLOG / param-mismatch/ param[1] (sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body'; kind
signalwire.rest.namespaces.compat.CompatPhoneNumbers.delete: BACKLOG / param-mismatch/ param[1] (sid)/ type 'any' vs 'string'
signalwire.rest.namespaces.compat.CompatPhoneNumbers.get: BACKLOG / param-mismatch/ param[1] (sid)/ type 'any' vs 'string'
signalwire.rest.namespaces.compat.CompatPhoneNumbers.import_number: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.compat.CompatPhoneNumbers.list: BACKLOG / param-mismatch/ param[1] (params)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<strin
signalwire.rest.namespaces.compat.CompatPhoneNumbers.list_available_countries: BACKLOG / param-mismatch/ param[1] (params)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<strin
signalwire.rest.namespaces.compat.CompatPhoneNumbers.purchase: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.compat.CompatPhoneNumbers.search_local: BACKLOG / param-mismatch/ param[1] (country)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.compat.CompatPhoneNumbers.search_toll_free: BACKLOG / param-mismatch/ param[1] (country)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.compat.CompatPhoneNumbers.update: BACKLOG / param-mismatch/ param[1] (sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body'; kind
signalwire.rest.namespaces.compat.CompatQueues.dequeue_member: BACKLOG / param-mismatch/ param[1] (queue_sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (call_sid)/ type 'any' vs 'string
signalwire.rest.namespaces.compat.CompatQueues.get_member: BACKLOG / param-mismatch/ param[1] (queue_sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (call_sid)/ type 'any' vs 'string
signalwire.rest.namespaces.compat.CompatQueues.list_members: BACKLOG / param-mismatch/ param[1] (queue_sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs '
signalwire.rest.namespaces.compat.CompatQueues.update: BACKLOG / param-mismatch/ param[1] (sid)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body'; kind
signalwire.rest.namespaces.compat.CompatRecordings.delete: BACKLOG / param-mismatch/ param[1] (sid)/ type 'any' vs 'string'
signalwire.rest.namespaces.compat.CompatRecordings.get: BACKLOG / param-mismatch/ param[1] (sid)/ type 'any' vs 'string'
signalwire.rest.namespaces.compat.CompatRecordings.list: BACKLOG / param-mismatch/ param[1] (params)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<strin
signalwire.rest.namespaces.compat.CompatTokens.create: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.compat.CompatTokens.delete: BACKLOG / param-mismatch/ param[1] (token_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.compat.CompatTokens.update: BACKLOG / param-mismatch/ param[1] (token_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body';
signalwire.rest.namespaces.compat.CompatTranscriptions.delete: BACKLOG / param-mismatch/ param[1] (sid)/ type 'any' vs 'string'
signalwire.rest.namespaces.compat.CompatTranscriptions.get: BACKLOG / param-mismatch/ param[1] (sid)/ type 'any' vs 'string'
signalwire.rest.namespaces.compat.CompatTranscriptions.list: BACKLOG / param-mismatch/ param[1] (params)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<strin
signalwire.rest.namespaces.datasphere.DatasphereDocuments.delete_chunk: BACKLOG / param-mismatch/ param[1] (document_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (chunk_id)/ type 'any' vs 'stri
signalwire.rest.namespaces.datasphere.DatasphereDocuments.get_chunk: BACKLOG / param-mismatch/ param[1] (document_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (chunk_id)/ type 'any' vs 'stri
signalwire.rest.namespaces.datasphere.DatasphereDocuments.list_chunks: BACKLOG / param-mismatch/ param[1] (document_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs
signalwire.rest.namespaces.datasphere.DatasphereDocuments.search: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.fabric.CallFlowsResource.deploy_version: BACKLOG / param-mismatch/ param[1] (resource_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'bod
signalwire.rest.namespaces.fabric.CallFlowsResource.list_addresses: BACKLOG / param-mismatch/ param[1] (resource_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs
signalwire.rest.namespaces.fabric.CallFlowsResource.list_versions: BACKLOG / param-mismatch/ param[1] (resource_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs
signalwire.rest.namespaces.fabric.ConferenceRoomsResource.list_addresses: BACKLOG / param-mismatch/ param[1] (resource_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs
signalwire.rest.namespaces.fabric.CxmlApplicationsResource.create: BACKLOG / param-count-mismatch/ reference has 2 param(s), port has 1/ reference=['self', 'kwargs'] port=['self']
signalwire.rest.namespaces.fabric.FabricAddresses.get: BACKLOG / param-mismatch/ param[1] (address_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.fabric.FabricAddresses.list: BACKLOG / param-mismatch/ param[1] (params)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<strin
signalwire.rest.namespaces.fabric.FabricTokens.create_embed_token: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'
signalwire.rest.namespaces.fabric.FabricTokens.create_guest_token: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'
signalwire.rest.namespaces.fabric.FabricTokens.create_invite_token: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'
signalwire.rest.namespaces.fabric.FabricTokens.create_subscriber_token: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'
signalwire.rest.namespaces.fabric.FabricTokens.refresh_subscriber_token: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'
signalwire.rest.namespaces.fabric.GenericResources.assign_domain_application: BACKLOG / param-mismatch/ param[1] (resource_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'bod
signalwire.rest.namespaces.fabric.GenericResources.assign_phone_route: BACKLOG / param-mismatch/ param[1] (resource_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'bod
signalwire.rest.namespaces.fabric.GenericResources.delete: BACKLOG / param-mismatch/ param[1] (resource_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.fabric.GenericResources.get: BACKLOG / param-mismatch/ param[1] (resource_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.fabric.GenericResources.list: BACKLOG / param-mismatch/ param[1] (params)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<strin
signalwire.rest.namespaces.fabric.GenericResources.list_addresses: BACKLOG / param-mismatch/ param[1] (resource_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs
signalwire.rest.namespaces.fabric.SubscribersResource.create_sip_endpoint: BACKLOG / param-mismatch/ param[1] (subscriber_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'b
signalwire.rest.namespaces.fabric.SubscribersResource.delete_sip_endpoint: BACKLOG / param-mismatch/ param[1] (subscriber_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (endpoint_id)/ type 'any' vs 
signalwire.rest.namespaces.fabric.SubscribersResource.get_sip_endpoint: BACKLOG / param-mismatch/ param[1] (subscriber_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (endpoint_id)/ type 'any' vs 
signalwire.rest.namespaces.fabric.SubscribersResource.list_sip_endpoints: BACKLOG / param-mismatch/ param[1] (subscriber_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' 
signalwire.rest.namespaces.fabric.SubscribersResource.update_sip_endpoint: BACKLOG / param-mismatch/ param[1] (subscriber_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (endpoint_id)/ type 'any' vs 
signalwire.rest.namespaces.imported_numbers.ImportedNumbersResource.create: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.logs.ConferenceLogs.list: BACKLOG / param-mismatch/ param[1] (params)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<strin
signalwire.rest.namespaces.logs.FaxLogs.get: BACKLOG / param-mismatch/ param[1] (log_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.logs.FaxLogs.list: BACKLOG / param-mismatch/ param[1] (params)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<strin
signalwire.rest.namespaces.logs.MessageLogs.get: BACKLOG / param-mismatch/ param[1] (log_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.logs.MessageLogs.list: BACKLOG / param-mismatch/ param[1] (params)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<strin
signalwire.rest.namespaces.logs.VoiceLogs.get: BACKLOG / param-mismatch/ param[1] (log_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.logs.VoiceLogs.list: BACKLOG / param-mismatch/ param[1] (params)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<strin
signalwire.rest.namespaces.logs.VoiceLogs.list_events: BACKLOG / param-mismatch/ param[1] (log_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'pos
signalwire.rest.namespaces.lookup.LookupResource.phone_number: BACKLOG / param-mismatch/ param[1] (e164)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'posit
signalwire.rest.namespaces.mfa.MfaResource.call: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.mfa.MfaResource.sms: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.mfa.MfaResource.verify: BACKLOG / param-mismatch/ param[1] (request_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body
signalwire.rest.namespaces.number_groups.NumberGroupsResource.add_membership: BACKLOG / param-mismatch/ param[1] (group_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body';
signalwire.rest.namespaces.number_groups.NumberGroupsResource.delete_membership: BACKLOG / param-mismatch/ param[1] (membership_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.number_groups.NumberGroupsResource.get_membership: BACKLOG / param-mismatch/ param[1] (membership_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.number_groups.NumberGroupsResource.list_memberships: BACKLOG / param-mismatch/ param[1] (group_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'p
signalwire.rest.namespaces.phone_numbers.PhoneNumbersResource.search: BACKLOG / param-mismatch/ param[1] (params)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<strin
signalwire.rest.namespaces.phone_numbers.PhoneNumbersResource.set_ai_agent: BACKLOG / param-mismatch/ param[3] (extra)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<string; return-mismatch/ retur
signalwire.rest.namespaces.phone_numbers.PhoneNumbersResource.set_call_flow: BACKLOG / param-count-mismatch/ reference has 5 param(s), port has 3/ reference=['self', 'resource_id', 'flow_id; return-mismatch/
signalwire.rest.namespaces.phone_numbers.PhoneNumbersResource.set_cxml_application: BACKLOG / param-mismatch/ param[3] (extra)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<string; return-mismatch/ retur
signalwire.rest.namespaces.phone_numbers.PhoneNumbersResource.set_cxml_webhook: BACKLOG / param-count-mismatch/ reference has 6 param(s), port has 3/ reference=['self', 'resource_id', 'url', '; return-mismatch/
signalwire.rest.namespaces.phone_numbers.PhoneNumbersResource.set_relay_application: BACKLOG / param-mismatch/ param[3] (extra)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<string; return-mismatch/ retur
signalwire.rest.namespaces.phone_numbers.PhoneNumbersResource.set_relay_topic: BACKLOG / param-count-mismatch/ reference has 5 param(s), port has 3/ reference=['self', 'resource_id', 'topic',; return-mismatch/
signalwire.rest.namespaces.phone_numbers.PhoneNumbersResource.set_swml_webhook: BACKLOG / param-mismatch/ param[3] (extra)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'class/signa; return-mismatch/ retur
signalwire.rest.namespaces.project.ProjectTokens.create: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.project.ProjectTokens.delete: BACKLOG / param-mismatch/ param[1] (token_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.project.ProjectTokens.update: BACKLOG / param-mismatch/ param[1] (token_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body';
signalwire.rest.namespaces.pubsub.PubSubResource.create_token: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.queues.QueuesResource.get_member: BACKLOG / param-mismatch/ param[1] (queue_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (member_id)/ type 'any' vs 'string
signalwire.rest.namespaces.queues.QueuesResource.get_next_member: BACKLOG / param-mismatch/ param[1] (queue_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.queues.QueuesResource.list_members: BACKLOG / param-mismatch/ param[1] (queue_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'p
signalwire.rest.namespaces.recordings.RecordingsResource.delete: BACKLOG / param-mismatch/ param[1] (recording_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.recordings.RecordingsResource.get: BACKLOG / param-mismatch/ param[1] (recording_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.recordings.RecordingsResource.list: BACKLOG / param-mismatch/ param[1] (params)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<strin
signalwire.rest.namespaces.registry.RegistryBrands.create: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.registry.RegistryBrands.create_campaign: BACKLOG / param-mismatch/ param[1] (brand_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body';
signalwire.rest.namespaces.registry.RegistryBrands.get: BACKLOG / param-mismatch/ param[1] (brand_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.registry.RegistryBrands.list: BACKLOG / param-mismatch/ param[1] (params)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<strin
signalwire.rest.namespaces.registry.RegistryBrands.list_campaigns: BACKLOG / param-mismatch/ param[1] (brand_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'p
signalwire.rest.namespaces.registry.RegistryCampaigns.create_order: BACKLOG / param-mismatch/ param[1] (campaign_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'bod
signalwire.rest.namespaces.registry.RegistryCampaigns.get: BACKLOG / param-mismatch/ param[1] (campaign_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.registry.RegistryCampaigns.list_numbers: BACKLOG / param-mismatch/ param[1] (campaign_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs
signalwire.rest.namespaces.registry.RegistryCampaigns.list_orders: BACKLOG / param-mismatch/ param[1] (campaign_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs
signalwire.rest.namespaces.registry.RegistryCampaigns.update: BACKLOG / param-mismatch/ param[1] (campaign_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'bod
signalwire.rest.namespaces.registry.RegistryNumbers.delete: BACKLOG / param-mismatch/ param[1] (number_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.registry.RegistryOrders.get: BACKLOG / param-mismatch/ param[1] (order_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.short_codes.ShortCodesResource.get: BACKLOG / param-mismatch/ param[1] (short_code_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.short_codes.ShortCodesResource.list: BACKLOG / param-mismatch/ param[1] (params)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<strin
signalwire.rest.namespaces.short_codes.ShortCodesResource.update: BACKLOG / param-mismatch/ param[1] (short_code_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'b
signalwire.rest.namespaces.sip_profile.SipProfileResource.update: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.verified_callers.VerifiedCallersResource.redial_verification: BACKLOG / param-mismatch/ param[1] (caller_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.verified_callers.VerifiedCallersResource.submit_verification: BACKLOG / param-mismatch/ param[1] (caller_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body'
signalwire.rest.namespaces.video.VideoConferenceTokens.get: BACKLOG / param-mismatch/ param[1] (token_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.video.VideoConferenceTokens.reset: BACKLOG / param-mismatch/ param[1] (token_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.video.VideoConferences.create_stream: BACKLOG / param-mismatch/ param[1] (conference_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'b
signalwire.rest.namespaces.video.VideoConferences.list_conference_tokens: BACKLOG / param-mismatch/ param[1] (conference_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' 
signalwire.rest.namespaces.video.VideoConferences.list_streams: BACKLOG / param-mismatch/ param[1] (conference_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' 
signalwire.rest.namespaces.video.VideoRoomRecordings.delete: BACKLOG / param-mismatch/ param[1] (recording_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.video.VideoRoomRecordings.get: BACKLOG / param-mismatch/ param[1] (recording_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.video.VideoRoomRecordings.list: BACKLOG / param-mismatch/ param[1] (params)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<strin
signalwire.rest.namespaces.video.VideoRoomRecordings.list_events: BACKLOG / param-mismatch/ param[1] (recording_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' v
signalwire.rest.namespaces.video.VideoRoomSessions.get: BACKLOG / param-mismatch/ param[1] (session_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.video.VideoRoomSessions.list: BACKLOG / param-mismatch/ param[1] (params)/ kind 'var_keyword' vs 'positional'; type 'any' vs 'dict<strin
signalwire.rest.namespaces.video.VideoRoomSessions.list_events: BACKLOG / param-mismatch/ param[1] (session_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 
signalwire.rest.namespaces.video.VideoRoomSessions.list_members: BACKLOG / param-mismatch/ param[1] (session_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 
signalwire.rest.namespaces.video.VideoRoomSessions.list_recordings: BACKLOG / param-mismatch/ param[1] (session_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 
signalwire.rest.namespaces.video.VideoRoomTokens.create: BACKLOG / param-mismatch/ param[1] (kwargs)/ name 'kwargs' vs 'body'; kind 'var_keyword' vs 'positional'; 
signalwire.rest.namespaces.video.VideoRooms.create_stream: BACKLOG / param-mismatch/ param[1] (room_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body'; 
signalwire.rest.namespaces.video.VideoRooms.list_streams: BACKLOG / param-mismatch/ param[1] (room_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (params)/ kind 'var_keyword' vs 'po
signalwire.rest.namespaces.video.VideoStreams.delete: BACKLOG / param-mismatch/ param[1] (stream_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.video.VideoStreams.get: BACKLOG / param-mismatch/ param[1] (stream_id)/ type 'any' vs 'string'
signalwire.rest.namespaces.video.VideoStreams.update: BACKLOG / param-mismatch/ param[1] (stream_id)/ type 'any' vs 'string'; param-mismatch/ param[2] (kwargs)/ name 'kwargs' vs 'body'
signalwire.rest.pagination.paginate: BACKLOG / missing-reference/ in port, not in reference
signalwire.rest.pagination.paginate_all: BACKLOG / missing-reference/ in port, not in reference
signalwire.run_agent: BACKLOG / missing-port/ in reference, not in port
signalwire.search.preprocess_document_content: BACKLOG / missing-port/ in reference, not in port
signalwire.search.preprocess_query: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.api_ninjas_trivia.skill.ApiNinjasTriviaSkill.get_instance_key: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.api_ninjas_trivia.skill.ApiNinjasTriviaSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.api_ninjas_trivia.skill.ApiNinjasTriviaSkill.get_tools: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.api_ninjas_trivia.skill.ApiNinjasTriviaSkill.setup: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.builtin.api_ninjas_trivia.ApiNinjasTriviaSkill.get_hints: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.api_ninjas_trivia.ApiNinjasTriviaSkill.get_instance_key: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.api_ninjas_trivia.ApiNinjasTriviaSkill.get_parameter_schema: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.api_ninjas_trivia.ApiNinjasTriviaSkill.get_tools: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.api_ninjas_trivia.create_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.ask_claude.AskClaudeSkill.get_parameter_schema: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.ask_claude.AskClaudeSkill.get_tools: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.ask_claude.create_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.claude_skills.ClaudeSkillsSkill.get_hints: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.claude_skills.ClaudeSkillsSkill.get_instance_key: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.claude_skills.ClaudeSkillsSkill.get_parameter_schema: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.claude_skills.ClaudeSkillsSkill.get_tools: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.claude_skills.ClaudeSkillsSkill.setup: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.claude_skills.create_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.custom_skills.CustomSkillsSkill.get_compilation_errors: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.custom_skills.CustomSkillsSkill.get_parameter_schema: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.custom_skills.CustomSkillsSkill.get_tools: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.custom_skills.create_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.datasphere.DataSphereSkill.get_global_data: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.datasphere.DataSphereSkill.get_instance_key: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.datasphere.DataSphereSkill.get_parameter_schema: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.datasphere.DataSphereSkill.get_tools: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.datasphere.DataSphereSkill.setup: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.datasphere.create_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.datasphere_serverless.DataSphereServerlessSkill.get_data_map_tools: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.datasphere_serverless.DataSphereServerlessSkill.get_global_data: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.datasphere_serverless.DataSphereServerlessSkill.get_instance_key: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.datasphere_serverless.DataSphereServerlessSkill.get_parameter_schema: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.datasphere_serverless.DataSphereServerlessSkill.get_tools: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.datasphere_serverless.DataSphereServerlessSkill.setup: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.datasphere_serverless.create_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.datetime.DateTimeSkill.get_parameter_schema: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.datetime.DateTimeSkill.get_tools: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.datetime.create_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.google_maps.GoogleMapsSkill.get_hints: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.google_maps.GoogleMapsSkill.get_parameter_schema: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.google_maps.GoogleMapsSkill.get_tools: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.google_maps.GoogleMapsSkill.setup: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.google_maps.create_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.index.register_builtin_skills: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.info_gatherer.InfoGathererSkill.get_global_data: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.info_gatherer.InfoGathererSkill.get_instance_key: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.info_gatherer.InfoGathererSkill.get_parameter_schema: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.info_gatherer.InfoGathererSkill.get_tools: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.info_gatherer.InfoGathererSkill.setup: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.info_gatherer.create_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.joke.JokeSkill.get_global_data: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.joke.JokeSkill.get_parameter_schema: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.joke.JokeSkill.get_tools: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.joke.create_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.math.MathSkill.get_parameter_schema: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.math.MathSkill.get_tools: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.math.create_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.mcp_gateway.McpGatewaySkill.get_global_data: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.mcp_gateway.McpGatewaySkill.get_hints: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.mcp_gateway.McpGatewaySkill.get_parameter_schema: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.mcp_gateway.McpGatewaySkill.get_tools: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.mcp_gateway.McpGatewaySkill.setup: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.mcp_gateway.create_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.native_vector_search.NativeVectorSearchSkill.cleanup: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.native_vector_search.NativeVectorSearchSkill.get_global_data: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.native_vector_search.NativeVectorSearchSkill.get_hints: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.native_vector_search.NativeVectorSearchSkill.get_instance_key: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.native_vector_search.NativeVectorSearchSkill.get_parameter_schema: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.native_vector_search.NativeVectorSearchSkill.get_tools: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.native_vector_search.NativeVectorSearchSkill.setup: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.native_vector_search.create_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.play_background_file.PlayBackgroundFileSkill.get_instance_key: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.play_background_file.PlayBackgroundFileSkill.get_parameter_schema: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.play_background_file.PlayBackgroundFileSkill.get_tools: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.play_background_file.create_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.spider.SpiderSkill.cleanup: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.spider.SpiderSkill.get_hints: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.spider.SpiderSkill.get_instance_key: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.spider.SpiderSkill.get_parameter_schema: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.spider.SpiderSkill.get_tools: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.spider.SpiderSkill.setup: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.spider.create_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.swml_transfer.SwmlTransferSkill.get_hints: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.swml_transfer.SwmlTransferSkill.get_instance_key: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.swml_transfer.SwmlTransferSkill.get_parameter_schema: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.swml_transfer.SwmlTransferSkill.get_tools: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.swml_transfer.SwmlTransferSkill.setup: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.swml_transfer.create_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.weather_api.WeatherApiSkill.get_parameter_schema: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.weather_api.WeatherApiSkill.get_tools: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.weather_api.WeatherApiSkill.setup: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.weather_api.create_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.web_search.WebSearchSkill.get_global_data: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.web_search.WebSearchSkill.get_instance_key: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.web_search.WebSearchSkill.get_parameter_schema: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.web_search.WebSearchSkill.get_tools: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.web_search.WebSearchSkill.setup: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.web_search.create_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.web_search.extract_text_from_html: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.wikipedia_search.WikipediaSearchSkill.get_parameter_schema: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.wikipedia_search.WikipediaSearchSkill.get_tools: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.wikipedia_search.WikipediaSearchSkill.search_wiki: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.wikipedia_search.WikipediaSearchSkill.setup: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.builtin.wikipedia_search.create_skill: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.claude_skills.skill.ClaudeSkillsSkill.get_hints: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.claude_skills.skill.ClaudeSkillsSkill.get_instance_key: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.claude_skills.skill.ClaudeSkillsSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.claude_skills.skill.ClaudeSkillsSkill.setup: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.datasphere.skill.DataSphereSkill.cleanup: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.datasphere.skill.DataSphereSkill.get_global_data: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.datasphere.skill.DataSphereSkill.get_hints: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.datasphere.skill.DataSphereSkill.get_instance_key: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.datasphere.skill.DataSphereSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.datasphere.skill.DataSphereSkill.get_prompt_sections: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.datasphere.skill.DataSphereSkill.setup: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.datasphere_serverless.skill.DataSphereServerlessSkill.get_global_data: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.datasphere_serverless.skill.DataSphereServerlessSkill.get_hints: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.datasphere_serverless.skill.DataSphereServerlessSkill.get_instance_key: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.datasphere_serverless.skill.DataSphereServerlessSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.datasphere_serverless.skill.DataSphereServerlessSkill.get_prompt_sections: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.datasphere_serverless.skill.DataSphereServerlessSkill.setup: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.datetime.skill.DateTimeSkill.get_hints: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.datetime.skill.DateTimeSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.datetime.skill.DateTimeSkill.get_prompt_sections: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.datetime.skill.DateTimeSkill.setup: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.google_maps.skill.GoogleMapsSkill.get_hints: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.google_maps.skill.GoogleMapsSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.google_maps.skill.GoogleMapsSkill.get_prompt_sections: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.google_maps.skill.GoogleMapsSkill.setup: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.info_gatherer.skill.InfoGathererSkill.get_global_data: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.info_gatherer.skill.InfoGathererSkill.get_instance_key: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.info_gatherer.skill.InfoGathererSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.info_gatherer.skill.InfoGathererSkill.setup: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.joke.skill.JokeSkill.get_global_data: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.joke.skill.JokeSkill.get_hints: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.joke.skill.JokeSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.joke.skill.JokeSkill.get_prompt_sections: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.joke.skill.JokeSkill.setup: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.math.skill.MathSkill.get_hints: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.math.skill.MathSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.math.skill.MathSkill.get_prompt_sections: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.math.skill.MathSkill.setup: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.native_vector_search.skill.NativeVectorSearchSkill.cleanup: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.native_vector_search.skill.NativeVectorSearchSkill.get_global_data: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.native_vector_search.skill.NativeVectorSearchSkill.get_hints: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.native_vector_search.skill.NativeVectorSearchSkill.get_instance_key: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.native_vector_search.skill.NativeVectorSearchSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.native_vector_search.skill.NativeVectorSearchSkill.get_prompt_sections: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.native_vector_search.skill.NativeVectorSearchSkill.setup: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.play_background_file.skill.PlayBackgroundFileSkill.get_instance_key: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.play_background_file.skill.PlayBackgroundFileSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.play_background_file.skill.PlayBackgroundFileSkill.get_tools: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.play_background_file.skill.PlayBackgroundFileSkill.setup: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.registry.SkillRegistry.add_search_path: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.registry.SkillRegistry.add_skill_directory: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.registry.SkillRegistry.discover_from_directory: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.registry.SkillRegistry.discover_skills: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.registry.SkillRegistry.get_all_skills_schema: BACKLOG / return-mismatch/ returns 'dict<string,dict<string,any>>' vs 'dict<string,any>'
signalwire.skills.registry.SkillRegistry.get_skill_class: BACKLOG / param-mismatch/ param[1] (skill_name)/ name 'skill_name' vs 'name'; return-mismatch/ returns 'optional<class/signalwire.
signalwire.skills.registry.SkillRegistry.list_all_skill_sources: BACKLOG / return-mismatch/ returns 'dict<string,list<string>>' vs 'dict<string,any>'
signalwire.skills.registry.SkillRegistry.register: BACKLOG / missing-reference/ in port, not in reference
signalwire.skills.registry.SkillRegistry.register_skill: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.spider.skill.SpiderSkill.cleanup: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.spider.skill.SpiderSkill.get_hints: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.spider.skill.SpiderSkill.get_instance_key: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.spider.skill.SpiderSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.spider.skill.SpiderSkill.setup: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.weather_api.skill.WeatherApiSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.weather_api.skill.WeatherApiSkill.get_tools: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.weather_api.skill.WeatherApiSkill.setup: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.web_search.skill.WebSearchSkill.get_global_data: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.web_search.skill.WebSearchSkill.get_hints: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.web_search.skill.WebSearchSkill.get_instance_key: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.web_search.skill.WebSearchSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.web_search.skill.WebSearchSkill.get_prompt_sections: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.web_search.skill.WebSearchSkill.setup: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.wikipedia_search.skill.WikipediaSearchSkill.get_hints: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.wikipedia_search.skill.WikipediaSearchSkill.get_parameter_schema: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.wikipedia_search.skill.WikipediaSearchSkill.get_prompt_sections: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.wikipedia_search.skill.WikipediaSearchSkill.search_wiki: BACKLOG / missing-port/ in reference, not in port
signalwire.skills.wikipedia_search.skill.WikipediaSearchSkill.setup: BACKLOG / missing-port/ in reference, not in port
signalwire.start_agent: BACKLOG / missing-port/ in reference, not in port
signalwire.utils.schema_utils.SchemaUtils.validate_verb: BACKLOG / param-mismatch/ param[2] (verb_config)/ name 'verb_config' vs 'config'; type 'dict<string,any>' ; return-mismatch/ retur
signalwire.web.web_service.WebService.start: BACKLOG / param-mismatch/ param[1] (host)/ default '0.0.0.0' vs None; param-mismatch/ param[2] (port)/ type 'optional<int>' vs 'fl
signalwire.web.web_service.WebService.stop: BACKLOG / return-mismatch/ returns 'any' vs 'void'
