# PORT_EXAMPLE_OMISSIONS.md

This file lists Python `examples/*.py` files for which the TypeScript port
ships a port-equivalent under a different filename. Each entry has a
one-line rationale that names the TS-side counterpart.

The porting-sdk's `audit_example_parity.py` walks both sets of files,
normalizes stems (lowercased, non-alphanumeric stripped), and asserts every
Python example has a TS equivalent with the same normalized stem. When the
TS port chose a different convention — typically dropping a Python-style
`_demo` / `_example` suffix that doesn't add information, or using
kebab-case where Python used snake_case for a multi-word concept — that
divergence is recorded here.

The format mirrors `PORT_OMISSIONS.md`:

    - <python_example_stem>: <one-line rationale>

Each rationale must name the TS file that provides the same
demonstrated capability.

---

## Naming convention divergences (TS uses different stem)

The TS port standardized on shorter, kebab-case file names that drop the
Python `_demo` / `_example` suffix when the demo nature is already obvious
from the directory context. Each line below maps the Python stem to the
shipping TS counterpart:

- advanced_datamap_demo: TS ships `examples/advanced-datamap.ts` (drops `_demo` suffix)
- auto_vivified_example: TS ships `examples/auto-vivified.ts` (drops `_example` suffix)
- call_flow_and_actions_demo: TS ships `examples/call-flow.ts` (covers both pre/post answer verbs and FunctionResult actions)
- comprehensive_dynamic_agent: TS ships `examples/comprehensive-dynamic.ts` (drops `_agent` suffix)
- concierge_agent_example: TS ships `examples/prefab-concierge.ts` (kebab-case prefab convention)
- contexts_demo: TS ships `examples/contexts-steps.ts` (named for the Context+Step focus)
- custom_path_agent: TS ships `examples/custom-path.ts` (drops `_agent` suffix)
- data_map_demo: TS ships `examples/datamap-tools.ts` (named for the DataMap-tool focus)
- datasphere_multi_instance_demo: TS ships `examples/datasphere-multi-instance.ts` (drops `_demo`)
- datasphere_webhook_env_demo: TS ships `examples/datasphere-webhook-env.ts` (drops `_demo`)
- declarative_agent: TS ships `examples/declarative.ts` (drops `_agent` suffix)
- dynamic_info_gatherer_example: TS ships `examples/dynamic-info-gatherer.ts` (drops `_example` suffix)
- faq_bot_agent: TS ships `examples/prefab-faq.ts` (kebab-case prefab convention)
- gather_info_demo: TS ships `examples/gather-info.ts` (drops `_demo` suffix)
- info_gatherer_example: TS ships `examples/prefab-info-gatherer.ts` (kebab-case prefab convention)
- joke_skill_demo: TS ships `examples/joke-agent.ts` (joke skill demonstrated through the agent)
- kubernetes_ready_agent: TS ships `examples/kubernetes-agent.ts` (drops `_ready` qualifier)
- lambda_agent: TS ships `examples/serverless-lambda.ts` (named for the serverless-deployment focus)
- llm_params_demo: TS ships `examples/llm-params.ts` (drops `_demo` suffix)
- mcp_gateway_demo: TS ships `examples/mcp-gateway.ts` (drops `_demo` suffix)
- multi_agent_server: TS ships `examples/multi-agent.ts` (kebab-case + drops `_server`)
- multi_endpoint_agent: TS ships `examples/multi-endpoint.ts` (kebab-case + drops `_agent`)
- receptionist_agent_example: TS ships `examples/prefab-receptionist.ts` (kebab-case prefab convention)
- record_call_example: TS ships `examples/record-call.ts` (drops `_example` suffix)
- relay_answer_and_welcome: TS ships `examples/relay-demo.ts` covering the same answer+TTS+hangup flow under a single demo file
- room_and_sip_example: TS ships `examples/room-and-sip.ts` (drops `_example` suffix)
- session_and_state_demo: TS ships `examples/session-state.ts` (drops `_and` / `_demo` for brevity)
- simple_dynamic_agent: TS ships `examples/dynamic-config.ts` (the simple dynamic-callback case)
- simple_dynamic_enhanced: TS ships `examples/advanced-dynamic-config.ts` (the enhanced/advanced case)
- simple_static_agent: TS ships `examples/simple-static.ts` (kebab-case + drops `_agent`)
- survey_agent_example: TS ships `examples/prefab-survey.ts` (kebab-case prefab convention)
- swaig_features_agent: TS ships `examples/swaig-features.ts` (kebab-case + drops `_agent`)
- swml_service_example: TS ships `examples/swml-service.ts` (kebab-case + drops `_example`)
- swml_service_routing_example: TS ships `examples/swml-service-routing.ts` (kebab-case + drops `_example`)
- tap_example: TS ships `examples/tap.ts` (drops `_example` suffix)
- web_search_agent: TS ships `examples/web-search.ts` (kebab-case + drops `_agent`)
- web_search_multi_instance_demo: TS ships `examples/web-search-multi-instance.ts` (kebab-case + drops `_demo`)
- wikipedia_demo: TS ships `examples/wikipedia.ts` (drops `_demo` suffix)
- basic_swml_service: TS ships `examples/swml-service.ts` (the canonical SWMLService walk-through)

## Search subsystem (deliberately not ported)

The native vector-search / pgvector / sigmond demos cover Python-only
infrastructure (`signalwire/search/`). The TS port exposes the entry-point
skill (`NativeVectorSearchSkill`) but does not ship a runnable demo for the
Python-specific server / CLI tooling. See `PORTING_GUIDE.md § What to Skip`.

- local_search_agent: deliberately omitted — local vector search relies on the Python-only `signalwire.search.*` server subsystem; not ported per `PORTING_GUIDE.md § What to Skip`.
