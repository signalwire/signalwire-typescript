# PORT_OMISSIONS.md

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

signalwire.search.document_processor.DocumentProcessor: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.document_processor.DocumentProcessor.__init__: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.document_processor.DocumentProcessor.create_chunks: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.index_builder.IndexBuilder: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.index_builder.IndexBuilder.__init__: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.index_builder.IndexBuilder.build_index: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.index_builder.IndexBuilder.build_index_from_sources: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.index_builder.IndexBuilder.validate_index: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.migration.SearchIndexMigrator: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.migration.SearchIndexMigrator.__init__: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.migration.SearchIndexMigrator.get_index_info: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.migration.SearchIndexMigrator.migrate_pgvector_to_sqlite: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.migration.SearchIndexMigrator.migrate_sqlite_to_pgvector: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.models.resolve_model_alias: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.pgvector_backend.PgVectorBackend: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.pgvector_backend.PgVectorBackend.__init__: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.pgvector_backend.PgVectorBackend.close: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.pgvector_backend.PgVectorBackend.create_schema: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.pgvector_backend.PgVectorBackend.delete_collection: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.pgvector_backend.PgVectorBackend.get_stats: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.pgvector_backend.PgVectorBackend.list_collections: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.pgvector_backend.PgVectorBackend.store_chunks: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.pgvector_backend.PgVectorSearchBackend: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.pgvector_backend.PgVectorSearchBackend.__init__: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.pgvector_backend.PgVectorSearchBackend.close: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.pgvector_backend.PgVectorSearchBackend.fetch_candidates: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.pgvector_backend.PgVectorSearchBackend.get_stats: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.pgvector_backend.PgVectorSearchBackend.search: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.query_processor.detect_language: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.query_processor.ensure_nltk_resources: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.query_processor.get_synonyms: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.query_processor.get_wordnet_pos: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.query_processor.load_spacy_model: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.query_processor.preprocess_document_content: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.query_processor.preprocess_query: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.query_processor.remove_duplicate_words: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.query_processor.set_global_model: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.query_processor.vectorize_query: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.search_engine.SearchEngine: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.search_engine.SearchEngine.__init__: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.search_engine.SearchEngine.get_stats: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.search_engine.SearchEngine.search: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.search_service.SearchService: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.search_service.SearchService.__init__: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.search_service.SearchService.search_direct: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.search_service.SearchService.start: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)
signalwire.search.search_service.SearchService.stop: deliberately omitted: native RAG/pgvector server subsystem not ported (see PORTING_GUIDE.md § What to Skip)

## Bedrock (AWS-specific agent)

signalwire.agents.bedrock.BedrockAgent: deliberately omitted: AWS Bedrock agent belongs to a Python-specific cloud path (see PORTING_GUIDE.md § What to Skip)
signalwire.agents.bedrock.BedrockAgent.__init__: deliberately omitted: AWS Bedrock agent belongs to a Python-specific cloud path (see PORTING_GUIDE.md § What to Skip)
signalwire.agents.bedrock.BedrockAgent.__repr__: deliberately omitted: AWS Bedrock agent belongs to a Python-specific cloud path (see PORTING_GUIDE.md § What to Skip)
signalwire.agents.bedrock.BedrockAgent.set_inference_params: deliberately omitted: AWS Bedrock agent belongs to a Python-specific cloud path (see PORTING_GUIDE.md § What to Skip)
signalwire.agents.bedrock.BedrockAgent.set_llm_model: deliberately omitted: AWS Bedrock agent belongs to a Python-specific cloud path (see PORTING_GUIDE.md § What to Skip)
signalwire.agents.bedrock.BedrockAgent.set_llm_temperature: deliberately omitted: AWS Bedrock agent belongs to a Python-specific cloud path (see PORTING_GUIDE.md § What to Skip)
signalwire.agents.bedrock.BedrockAgent.set_post_prompt_llm_params: deliberately omitted: AWS Bedrock agent belongs to a Python-specific cloud path (see PORTING_GUIDE.md § What to Skip)
signalwire.agents.bedrock.BedrockAgent.set_prompt_llm_params: deliberately omitted: AWS Bedrock agent belongs to a Python-specific cloud path (see PORTING_GUIDE.md § What to Skip)
signalwire.agents.bedrock.BedrockAgent.set_voice: deliberately omitted: AWS Bedrock agent belongs to a Python-specific cloud path (see PORTING_GUIDE.md § What to Skip)

## CLI: init_project

signalwire.cli.init_project.Colors: deliberately omitted: Python-specific project scaffolding CLI
signalwire.cli.init_project.ProjectGenerator: deliberately omitted: Python-specific project scaffolding CLI
signalwire.cli.init_project.ProjectGenerator.__init__: deliberately omitted: Python-specific project scaffolding CLI
signalwire.cli.init_project.ProjectGenerator.generate: deliberately omitted: Python-specific project scaffolding CLI
signalwire.cli.init_project.generate_password: deliberately omitted: Python-specific project scaffolding CLI
signalwire.cli.init_project.get_agent_template: deliberately omitted: Python-specific project scaffolding CLI
signalwire.cli.init_project.get_app_template: deliberately omitted: Python-specific project scaffolding CLI
signalwire.cli.init_project.get_env_credentials: deliberately omitted: Python-specific project scaffolding CLI
signalwire.cli.init_project.get_readme_template: deliberately omitted: Python-specific project scaffolding CLI
signalwire.cli.init_project.get_test_template: deliberately omitted: Python-specific project scaffolding CLI
signalwire.cli.init_project.get_web_index_template: deliberately omitted: Python-specific project scaffolding CLI
signalwire.cli.init_project.main: deliberately omitted: Python-specific project scaffolding CLI
signalwire.cli.init_project.mask_token: deliberately omitted: Python-specific project scaffolding CLI
signalwire.cli.init_project.print_error: deliberately omitted: Python-specific project scaffolding CLI
signalwire.cli.init_project.print_step: deliberately omitted: Python-specific project scaffolding CLI
signalwire.cli.init_project.print_success: deliberately omitted: Python-specific project scaffolding CLI
signalwire.cli.init_project.print_warning: deliberately omitted: Python-specific project scaffolding CLI
signalwire.cli.init_project.prompt: deliberately omitted: Python-specific project scaffolding CLI
signalwire.cli.init_project.prompt_multiselect: deliberately omitted: Python-specific project scaffolding CLI
signalwire.cli.init_project.prompt_select: deliberately omitted: Python-specific project scaffolding CLI
signalwire.cli.init_project.prompt_yes_no: deliberately omitted: Python-specific project scaffolding CLI
signalwire.cli.init_project.run_interactive: deliberately omitted: Python-specific project scaffolding CLI
signalwire.cli.init_project.run_quick: deliberately omitted: Python-specific project scaffolding CLI

## CLI: dokku

signalwire.cli.dokku.Colors: deliberately omitted: Dokku deployment CLI is Python-specific tooling
signalwire.cli.dokku.DokkuProjectGenerator: deliberately omitted: Dokku deployment CLI is Python-specific tooling
signalwire.cli.dokku.DokkuProjectGenerator.__init__: deliberately omitted: Dokku deployment CLI is Python-specific tooling
signalwire.cli.dokku.DokkuProjectGenerator.generate: deliberately omitted: Dokku deployment CLI is Python-specific tooling
signalwire.cli.dokku.cmd_config: deliberately omitted: Dokku deployment CLI is Python-specific tooling
signalwire.cli.dokku.cmd_deploy: deliberately omitted: Dokku deployment CLI is Python-specific tooling
signalwire.cli.dokku.cmd_init: deliberately omitted: Dokku deployment CLI is Python-specific tooling
signalwire.cli.dokku.cmd_logs: deliberately omitted: Dokku deployment CLI is Python-specific tooling
signalwire.cli.dokku.cmd_scale: deliberately omitted: Dokku deployment CLI is Python-specific tooling
signalwire.cli.dokku.generate_password: deliberately omitted: Dokku deployment CLI is Python-specific tooling
signalwire.cli.dokku.main: deliberately omitted: Dokku deployment CLI is Python-specific tooling
signalwire.cli.dokku.print_error: deliberately omitted: Dokku deployment CLI is Python-specific tooling
signalwire.cli.dokku.print_header: deliberately omitted: Dokku deployment CLI is Python-specific tooling
signalwire.cli.dokku.print_step: deliberately omitted: Dokku deployment CLI is Python-specific tooling
signalwire.cli.dokku.print_success: deliberately omitted: Dokku deployment CLI is Python-specific tooling
signalwire.cli.dokku.print_warning: deliberately omitted: Dokku deployment CLI is Python-specific tooling
signalwire.cli.dokku.prompt: deliberately omitted: Dokku deployment CLI is Python-specific tooling
signalwire.cli.dokku.prompt_yes_no: deliberately omitted: Dokku deployment CLI is Python-specific tooling

## CLI: simulation / mock env

signalwire.cli.simulation.data_generation.adapt_for_call_type: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.data_generation.generate_comprehensive_post_data: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.data_generation.generate_fake_node_id: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.data_generation.generate_fake_sip_from: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.data_generation.generate_fake_sip_to: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.data_generation.generate_fake_swml_post_data: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.data_generation.generate_fake_uuid: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.data_generation.generate_minimal_post_data: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.data_overrides.apply_convenience_mappings: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.data_overrides.apply_overrides: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.data_overrides.parse_value: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.data_overrides.set_nested_value: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.MockHeaders: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.MockHeaders.__contains__: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.MockHeaders.__getitem__: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.MockHeaders.__init__: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.MockHeaders.get: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.MockHeaders.items: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.MockHeaders.keys: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.MockHeaders.values: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.MockQueryParams: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.MockQueryParams.__contains__: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.MockQueryParams.__getitem__: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.MockQueryParams.__init__: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.MockQueryParams.get: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.MockQueryParams.items: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.MockQueryParams.keys: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.MockQueryParams.values: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.MockRequest: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.MockRequest.__init__: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.MockRequest.body: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.MockRequest.client: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.MockRequest.json: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.MockURL: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.MockURL.__init__: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.MockURL.__str__: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.ServerlessSimulator: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.ServerlessSimulator.__init__: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.ServerlessSimulator.activate: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.ServerlessSimulator.add_override: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.ServerlessSimulator.deactivate: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.ServerlessSimulator.get_current_env: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.create_mock_request: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI
signalwire.cli.simulation.mock_env.load_env_file: deliberately omitted: Python-specific request simulation helpers used only by the Python swaig-test CLI

## CLI: agent/service/argparse loaders

signalwire.cli.core.agent_loader.discover_agents_in_file: deliberately omitted: Python-specific dynamic-import loaders (argparse_helpers, agent_loader, service_loader, dynamic_config)
signalwire.cli.core.agent_loader.discover_services_in_file: deliberately omitted: Python-specific dynamic-import loaders (argparse_helpers, agent_loader, service_loader, dynamic_config)
signalwire.cli.core.agent_loader.load_agent_from_file: deliberately omitted: Python-specific dynamic-import loaders (argparse_helpers, agent_loader, service_loader, dynamic_config)
signalwire.cli.core.agent_loader.load_service_from_file: deliberately omitted: Python-specific dynamic-import loaders (argparse_helpers, agent_loader, service_loader, dynamic_config)
signalwire.cli.core.argparse_helpers.CustomArgumentParser: deliberately omitted: Python-specific dynamic-import loaders (argparse_helpers, agent_loader, service_loader, dynamic_config)
signalwire.cli.core.argparse_helpers.CustomArgumentParser.__init__: deliberately omitted: Python-specific dynamic-import loaders (argparse_helpers, agent_loader, service_loader, dynamic_config)
signalwire.cli.core.argparse_helpers.CustomArgumentParser.error: deliberately omitted: Python-specific dynamic-import loaders (argparse_helpers, agent_loader, service_loader, dynamic_config)
signalwire.cli.core.argparse_helpers.CustomArgumentParser.parse_args: deliberately omitted: Python-specific dynamic-import loaders (argparse_helpers, agent_loader, service_loader, dynamic_config)
signalwire.cli.core.argparse_helpers.CustomArgumentParser.print_usage: deliberately omitted: Python-specific dynamic-import loaders (argparse_helpers, agent_loader, service_loader, dynamic_config)
signalwire.cli.core.argparse_helpers.parse_function_arguments: deliberately omitted: Python-specific dynamic-import loaders (argparse_helpers, agent_loader, service_loader, dynamic_config)
signalwire.cli.core.dynamic_config.apply_dynamic_config: deliberately omitted: Python-specific dynamic-import loaders (argparse_helpers, agent_loader, service_loader, dynamic_config)
signalwire.cli.core.service_loader.ServiceCapture: deliberately omitted: Python-specific dynamic-import loaders (argparse_helpers, agent_loader, service_loader, dynamic_config)
signalwire.cli.core.service_loader.ServiceCapture.__init__: deliberately omitted: Python-specific dynamic-import loaders (argparse_helpers, agent_loader, service_loader, dynamic_config)
signalwire.cli.core.service_loader.ServiceCapture.capture: deliberately omitted: Python-specific dynamic-import loaders (argparse_helpers, agent_loader, service_loader, dynamic_config)
signalwire.cli.core.service_loader.discover_agents_in_file: deliberately omitted: Python-specific dynamic-import loaders (argparse_helpers, agent_loader, service_loader, dynamic_config)
signalwire.cli.core.service_loader.load_agent_from_file: deliberately omitted: Python-specific dynamic-import loaders (argparse_helpers, agent_loader, service_loader, dynamic_config)
signalwire.cli.core.service_loader.load_and_simulate_service: deliberately omitted: Python-specific dynamic-import loaders (argparse_helpers, agent_loader, service_loader, dynamic_config)
signalwire.cli.core.service_loader.simulate_request_to_service: deliberately omitted: Python-specific dynamic-import loaders (argparse_helpers, agent_loader, service_loader, dynamic_config)

## CLI: build_search

signalwire.cli.build_search.console_entry_point: deliberately omitted: build_search CLI is tied to the Python native RAG pipeline
signalwire.cli.build_search.main: deliberately omitted: build_search CLI is tied to the Python native RAG pipeline
signalwire.cli.build_search.migrate_command: deliberately omitted: build_search CLI is tied to the Python native RAG pipeline
signalwire.cli.build_search.remote_command: deliberately omitted: build_search CLI is tied to the Python native RAG pipeline
signalwire.cli.build_search.search_command: deliberately omitted: build_search CLI is tied to the Python native RAG pipeline
signalwire.cli.build_search.validate_command: deliberately omitted: build_search CLI is tied to the Python native RAG pipeline

## CLI: execution

signalwire.cli.execution.datamap_exec.execute_datamap_function: deliberately omitted: Python-specific serverless exec helpers for swaig-test
signalwire.cli.execution.datamap_exec.simple_template_expand: deliberately omitted: Python-specific serverless exec helpers for swaig-test
signalwire.cli.execution.webhook_exec.execute_external_webhook_function: deliberately omitted: Python-specific serverless exec helpers for swaig-test

## CLI: output formatting

signalwire.cli.output.output_formatter.display_agent_tools: deliberately omitted: swaig-test output formatters used only by the Python CLI
signalwire.cli.output.output_formatter.format_result: deliberately omitted: swaig-test output formatters used only by the Python CLI
signalwire.cli.output.swml_dump.handle_dump_swml: deliberately omitted: swaig-test output formatters used only by the Python CLI
signalwire.cli.output.swml_dump.setup_output_suppression: deliberately omitted: swaig-test output formatters used only by the Python CLI

## CLI: test_swaig / swaig_test_wrapper

signalwire.cli.swaig_test_wrapper.main: not_yet_implemented: the full swaig-test CLI is a candidate for a future port; the TS SDK ships a lighter swaig-test bin that covers the core call-simulation use case
signalwire.cli.test_swaig.console_entry_point: not_yet_implemented: the full swaig-test CLI is a candidate for a future port; the TS SDK ships a lighter swaig-test bin that covers the core call-simulation use case
signalwire.cli.test_swaig.main: not_yet_implemented: the full swaig-test CLI is a candidate for a future port; the TS SDK ships a lighter swaig-test bin that covers the core call-simulation use case
signalwire.cli.test_swaig.print_help_examples: not_yet_implemented: the full swaig-test CLI is a candidate for a future port; the TS SDK ships a lighter swaig-test bin that covers the core call-simulation use case
signalwire.cli.test_swaig.print_help_platforms: not_yet_implemented: the full swaig-test CLI is a candidate for a future port; the TS SDK ships a lighter swaig-test bin that covers the core call-simulation use case

## CLI: type definitions

signalwire.cli.types.AgentInfo: deliberately omitted: CLI type definitions used only by the Python CLI internals
signalwire.cli.types.CallData: deliberately omitted: CLI type definitions used only by the Python CLI internals
signalwire.cli.types.DataMapConfig: deliberately omitted: CLI type definitions used only by the Python CLI internals
signalwire.cli.types.FunctionInfo: deliberately omitted: CLI type definitions used only by the Python CLI internals
signalwire.cli.types.PostData: deliberately omitted: CLI type definitions used only by the Python CLI internals
signalwire.cli.types.VarsData: deliberately omitted: CLI type definitions used only by the Python CLI internals

## POM module (low-level PromptObjectModel)

# signalwire.pom.pom.PromptObjectModel and signalwire.pom.pom.Section are now
# ported in TS at src/POM/PromptObjectModel.ts (mapped to signalwire.pom.pom).
# The pom_tool CLI helpers remain Python-only.
signalwire.pom.pom_tool.detect_file_format: deliberately omitted: pom_tool is a Python CLI helper (detect/load/render); TS does not ship a CLI for offline POM rendering
signalwire.pom.pom_tool.load_pom: deliberately omitted: pom_tool is a Python CLI helper (detect/load/render); TS does not ship a CLI for offline POM rendering
signalwire.pom.pom_tool.main: deliberately omitted: pom_tool is a Python CLI helper (detect/load/render); TS does not ship a CLI for offline POM rendering
signalwire.pom.pom_tool.render_pom: deliberately omitted: pom_tool is a Python CLI helper (detect/load/render); TS does not ship a CLI for offline POM rendering

## MCP gateway backend (server-side MCP router)

signalwire.mcp_gateway.gateway_service.MCPGateway: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.gateway_service.MCPGateway.__init__: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.gateway_service.MCPGateway.run: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.gateway_service.MCPGateway.shutdown: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.gateway_service.main: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.mcp_manager.MCPClient: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.mcp_manager.MCPClient.__init__: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.mcp_manager.MCPClient.call_method: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.mcp_manager.MCPClient.call_tool: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.mcp_manager.MCPClient.get_tools: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.mcp_manager.MCPClient.start: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.mcp_manager.MCPClient.stop: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.mcp_manager.MCPManager: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.mcp_manager.MCPManager.__init__: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.mcp_manager.MCPManager.create_client: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.mcp_manager.MCPManager.get_service: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.mcp_manager.MCPManager.get_service_tools: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.mcp_manager.MCPManager.list_services: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.mcp_manager.MCPManager.shutdown: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.mcp_manager.MCPManager.validate_services: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.mcp_manager.MCPService: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.mcp_manager.MCPService.__hash__: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.mcp_manager.MCPService.__post_init__: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.session_manager.Session: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.session_manager.Session.is_alive: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.session_manager.Session.is_expired: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.session_manager.Session.touch: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.session_manager.SessionManager: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.session_manager.SessionManager.__init__: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.session_manager.SessionManager.close_session: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.session_manager.SessionManager.create_session: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.session_manager.SessionManager.get_service_session_count: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.session_manager.SessionManager.get_session: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.session_manager.SessionManager.list_sessions: deliberately omitted: standalone MCP gateway service process is a Python-only server component
signalwire.mcp_gateway.session_manager.SessionManager.shutdown: deliberately omitted: standalone MCP gateway service process is a Python-only server component

## Mixin class identifiers (folded into AgentBase in TS)

signalwire.core.mixins.mcp_server_mixin.MCPServerMixin: TS architecture folds all mixins into AgentBase directly — mixin class names have no TS counterpart (the methods themselves are folded and present on AgentBase)
signalwire.core.mixins.prompt_mixin.PromptMixin.contexts: TS architecture folds all mixins into AgentBase directly — mixin class names have no TS counterpart (the methods themselves are folded and present on AgentBase)
signalwire.core.mixins.serverless_mixin.ServerlessMixin: TS architecture folds all mixins into AgentBase directly — mixin class names have no TS counterpart (the methods themselves are folded and present on AgentBase)
signalwire.core.mixins.serverless_mixin.ServerlessMixin.handle_serverless_request: TS architecture folds all mixins into AgentBase directly — mixin class names have no TS counterpart (the methods themselves are folded and present on AgentBase)
signalwire.core.mixins.tool_mixin.ToolMixin.tool: TS architecture folds all mixins into AgentBase directly — mixin class names have no TS counterpart (the methods themselves are folded and present on AgentBase)
signalwire.core.mixins.web_mixin.WebMixin.on_request: TS architecture folds all mixins into AgentBase directly — mixin class names have no TS counterpart (the methods themselves are folded and present on AgentBase)

## Web-search variants (skill_improved / skill_original)

signalwire.skills.web_search.skill_improved.GoogleSearchScraper: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_improved.GoogleSearchScraper.__init__: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_improved.GoogleSearchScraper.extract_text_from_url: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_improved.GoogleSearchScraper.search_and_scrape: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_improved.GoogleSearchScraper.search_and_scrape_best: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_improved.GoogleSearchScraper.search_google: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_improved.WebSearchSkill: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_improved.WebSearchSkill.get_global_data: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_improved.WebSearchSkill.get_hints: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_improved.WebSearchSkill.get_instance_key: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_improved.WebSearchSkill.get_parameter_schema: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_improved.WebSearchSkill.get_prompt_sections: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_improved.WebSearchSkill.register_tools: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_improved.WebSearchSkill.setup: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_original.GoogleSearchScraper: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_original.GoogleSearchScraper.__init__: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_original.GoogleSearchScraper.extract_text_from_url: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_original.GoogleSearchScraper.search_and_scrape: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_original.GoogleSearchScraper.search_google: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_original.WebSearchSkill: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_original.WebSearchSkill.get_global_data: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_original.WebSearchSkill.get_hints: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_original.WebSearchSkill.get_instance_key: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_original.WebSearchSkill.get_parameter_schema: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_original.WebSearchSkill.get_prompt_sections: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_original.WebSearchSkill.register_tools: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one
signalwire.skills.web_search.skill_original.WebSearchSkill.setup: deliberately omitted: Python ships `skill_improved` / `skill_original` historical variants alongside the canonical `skill`; TS keeps only the canonical one

## Skills: explicit register_tools method

signalwire.core.skill_base.SkillBase.register_tools: TS SkillBase handles tool registration automatically inside addSkill() via the getTools() contract; concrete skills do not need to expose a separate register_tools hook
signalwire.skills.api_ninjas_trivia.skill.ApiNinjasTriviaSkill.register_tools: TS SkillBase handles tool registration automatically inside addSkill() via the getTools() contract; concrete skills do not need to expose a separate register_tools hook
signalwire.skills.claude_skills.skill.ClaudeSkillsSkill.register_tools: TS SkillBase handles tool registration automatically inside addSkill() via the getTools() contract; concrete skills do not need to expose a separate register_tools hook
signalwire.skills.datasphere.skill.DataSphereSkill.register_tools: TS SkillBase handles tool registration automatically inside addSkill() via the getTools() contract; concrete skills do not need to expose a separate register_tools hook
signalwire.skills.datasphere_serverless.skill.DataSphereServerlessSkill.register_tools: TS SkillBase handles tool registration automatically inside addSkill() via the getTools() contract; concrete skills do not need to expose a separate register_tools hook
signalwire.skills.datetime.skill.DateTimeSkill.register_tools: TS SkillBase handles tool registration automatically inside addSkill() via the getTools() contract; concrete skills do not need to expose a separate register_tools hook
signalwire.skills.google_maps.skill.GoogleMapsSkill.register_tools: TS SkillBase handles tool registration automatically inside addSkill() via the getTools() contract; concrete skills do not need to expose a separate register_tools hook
signalwire.skills.info_gatherer.skill.InfoGathererSkill.register_tools: TS SkillBase handles tool registration automatically inside addSkill() via the getTools() contract; concrete skills do not need to expose a separate register_tools hook
signalwire.skills.joke.skill.JokeSkill.register_tools: TS SkillBase handles tool registration automatically inside addSkill() via the getTools() contract; concrete skills do not need to expose a separate register_tools hook
signalwire.skills.math.skill.MathSkill.register_tools: TS SkillBase handles tool registration automatically inside addSkill() via the getTools() contract; concrete skills do not need to expose a separate register_tools hook
signalwire.skills.mcp_gateway.skill.MCPGatewaySkill.register_tools: TS SkillBase handles tool registration automatically inside addSkill() via the getTools() contract; concrete skills do not need to expose a separate register_tools hook
signalwire.skills.native_vector_search.skill.NativeVectorSearchSkill.register_tools: TS SkillBase handles tool registration automatically inside addSkill() via the getTools() contract; concrete skills do not need to expose a separate register_tools hook
signalwire.skills.play_background_file.skill.PlayBackgroundFileSkill.register_tools: TS SkillBase handles tool registration automatically inside addSkill() via the getTools() contract; concrete skills do not need to expose a separate register_tools hook
signalwire.skills.spider.skill.SpiderSkill.register_tools: TS SkillBase handles tool registration automatically inside addSkill() via the getTools() contract; concrete skills do not need to expose a separate register_tools hook
signalwire.skills.swml_transfer.skill.SWMLTransferSkill.register_tools: TS SkillBase handles tool registration automatically inside addSkill() via the getTools() contract; concrete skills do not need to expose a separate register_tools hook
signalwire.skills.weather_api.skill.WeatherApiSkill.register_tools: TS SkillBase handles tool registration automatically inside addSkill() via the getTools() contract; concrete skills do not need to expose a separate register_tools hook
signalwire.skills.web_search.skill.WebSearchSkill.register_tools: TS SkillBase handles tool registration automatically inside addSkill() via the getTools() contract; concrete skills do not need to expose a separate register_tools hook
signalwire.skills.web_search.skill_improved.WebSearchSkill.register_tools: TS SkillBase handles tool registration automatically inside addSkill() via the getTools() contract; concrete skills do not need to expose a separate register_tools hook
signalwire.skills.web_search.skill_original.WebSearchSkill.register_tools: TS SkillBase handles tool registration automatically inside addSkill() via the getTools() contract; concrete skills do not need to expose a separate register_tools hook
signalwire.skills.wikipedia_search.skill.WikipediaSearchSkill.register_tools: TS SkillBase handles tool registration automatically inside addSkill() via the getTools() contract; concrete skills do not need to expose a separate register_tools hook

## Prefab tool-handler methods (closure-based in TS)

signalwire.prefabs.concierge.ConciergeAgent.check_availability: prefab tool handler method — TS prefabs use closure-based tools rather than named methods; behavior is equivalent
signalwire.prefabs.concierge.ConciergeAgent.get_directions: prefab tool handler method — TS prefabs use closure-based tools rather than named methods; behavior is equivalent
signalwire.prefabs.faq_bot.FAQBotAgent.search_faqs: prefab tool handler method — TS prefabs use closure-based tools rather than named methods; behavior is equivalent
signalwire.prefabs.info_gatherer.InfoGathererAgent.start_questions: prefab tool handler method — TS prefabs use closure-based tools rather than named methods; behavior is equivalent
signalwire.prefabs.info_gatherer.InfoGathererAgent.submit_answer: prefab tool handler method — TS prefabs use closure-based tools rather than named methods; behavior is equivalent
signalwire.prefabs.survey.SurveyAgent.log_response: prefab tool handler method — TS prefabs use closure-based tools rather than named methods; behavior is equivalent
signalwire.prefabs.survey.SurveyAgent.validate_response: prefab tool handler method — TS prefabs use closure-based tools rather than named methods; behavior is equivalent

## Python dunder methods (no TS equivalent)

signalwire.agents.bedrock.BedrockAgent.__repr__: Python-specific dunder method with no idiomatic TS equivalent (constructor, iterator, context-manager, and stringification protocols are handled by built-in TS features)
signalwire.cli.simulation.mock_env.MockHeaders.__contains__: Python-specific dunder method with no idiomatic TS equivalent (constructor, iterator, context-manager, and stringification protocols are handled by built-in TS features)
signalwire.cli.simulation.mock_env.MockHeaders.__getitem__: Python-specific dunder method with no idiomatic TS equivalent (constructor, iterator, context-manager, and stringification protocols are handled by built-in TS features)
signalwire.cli.simulation.mock_env.MockQueryParams.__contains__: Python-specific dunder method with no idiomatic TS equivalent (constructor, iterator, context-manager, and stringification protocols are handled by built-in TS features)
signalwire.cli.simulation.mock_env.MockQueryParams.__getitem__: Python-specific dunder method with no idiomatic TS equivalent (constructor, iterator, context-manager, and stringification protocols are handled by built-in TS features)
signalwire.core.swaig_function.SWAIGFunction.__call__: Python-specific dunder method with no idiomatic TS equivalent (constructor, iterator, context-manager, and stringification protocols are handled by built-in TS features)
signalwire.core.swml_builder.SWMLBuilder.__getattr__: Python-specific dunder method with no idiomatic TS equivalent (constructor, iterator, context-manager, and stringification protocols are handled by built-in TS features)
signalwire.core.swml_service.SWMLService.__getattr__: Python-specific dunder method with no idiomatic TS equivalent (constructor, iterator, context-manager, and stringification protocols are handled by built-in TS features)
signalwire.relay.call.Call.__repr__: Python-specific dunder method with no idiomatic TS equivalent (constructor, iterator, context-manager, and stringification protocols are handled by built-in TS features)
signalwire.relay.client.RelayClient.__aenter__: Python-specific dunder method with no idiomatic TS equivalent (constructor, iterator, context-manager, and stringification protocols are handled by built-in TS features)
signalwire.relay.client.RelayClient.__aexit__: Python-specific dunder method with no idiomatic TS equivalent (constructor, iterator, context-manager, and stringification protocols are handled by built-in TS features)
signalwire.relay.client.RelayClient.__del__: Python-specific dunder method with no idiomatic TS equivalent (constructor, iterator, context-manager, and stringification protocols are handled by built-in TS features)
signalwire.relay.message.Message.__repr__: Python-specific dunder method with no idiomatic TS equivalent (constructor, iterator, context-manager, and stringification protocols are handled by built-in TS features)
signalwire.rest._pagination.PaginatedIterator.__iter__: Python-specific dunder method with no idiomatic TS equivalent (constructor, iterator, context-manager, and stringification protocols are handled by built-in TS features)
signalwire.rest._pagination.PaginatedIterator.__next__: Python-specific dunder method with no idiomatic TS equivalent (constructor, iterator, context-manager, and stringification protocols are handled by built-in TS features)

## Individual omissions (case-by-case)

signalwire.core.agent.prompt.manager.PromptManager.get_contexts: not_yet_implemented: PromptManager currently exposes prompt text but not the contexts map; add a getContexts() accessor in a future PR
signalwire.core.agent.prompt.manager.PromptManager.get_raw_prompt: not_yet_implemented: expose raw-prompt accessor in a future PR
signalwire.core.agent.tools.decorator.ToolDecorator: deliberately omitted: Python uses decorators for tool registration; TS uses imperative defineTool() instead, which is idiomatic for TypeScript
signalwire.core.agent.tools.decorator.ToolDecorator.create_class_decorator: deliberately omitted: see ToolDecorator rationale
signalwire.core.agent.tools.decorator.ToolDecorator.create_instance_decorator: deliberately omitted: see ToolDecorator rationale
signalwire.core.agent.tools.registry.ToolRegistry.get_all_functions: not_yet_implemented: expose on a registry accessor in a future PR; today the tool list is accessible via AgentBase.getTools()
signalwire.core.agent.tools.registry.ToolRegistry.get_function: not_yet_implemented: accessible today as AgentBase.getTool(); registry-level API could be added later
signalwire.core.agent.tools.registry.ToolRegistry.has_function: not_yet_implemented: derivable from AgentBase.getTool(); registry-level predicate could be added later
signalwire.core.agent.tools.registry.ToolRegistry.register_class_decorated_tools: deliberately omitted: TS does not use decorator-based tool registration (see ToolDecorator)
signalwire.core.agent.tools.registry.ToolRegistry.remove_function: not_yet_implemented: remove-by-name not yet exposed; add in a future PR
signalwire.core.auth_handler.AuthHandler.flask_decorator: deliberately omitted: Flask-specific integration; TS ships Hono-native middleware via AgentBase.getApp() instead
signalwire.core.auth_handler.AuthHandler.get_fastapi_dependency: deliberately omitted: FastAPI-specific integration; TS ships Hono-native middleware
signalwire.core.logging_config.configure_logging: TS uses Logger module-level configuration (setGlobalLogLevel / setGlobalLogFormat / resetLoggingConfiguration); no top-level configure_logging wrapper needed
signalwire.core.security_config.SecurityConfig.get_cors_config: not_yet_implemented: SecurityConfig exposes SSL + auth today; CORS helpers can be added in a follow-up
signalwire.core.security_config.SecurityConfig.get_security_headers: not_yet_implemented: TS applies security headers in WebService directly; centralized helper not yet ported
signalwire.core.security_config.SecurityConfig.get_ssl_context_kwargs: deliberately omitted: TS uses SslConfig.getServerOptions() for node:https; kwargs translation is Python-specific
signalwire.core.security_config.SecurityConfig.get_url_scheme: not_yet_implemented: trivial to add (sslEnabled ? "https" : "http"); follow-up PR
signalwire.core.security_config.SecurityConfig.load_from_env: TS SecurityConfig loads from env in its constructor; no separate load_from_env classmethod needed
signalwire.core.security_config.SecurityConfig.log_config: not_yet_implemented: add a diagnostic logger in a follow-up PR
signalwire.core.security_config.SecurityConfig.should_allow_host: not_yet_implemented: host-allowlist check not yet exposed; add when needed
signalwire.core.swml_builder.SWMLBuilder.ai: not_yet_implemented: SwmlBuilder today uses addVerb(); dedicated .ai() convenience wrapper can be added later
signalwire.core.swml_builder.SWMLBuilder.answer: not_yet_implemented: same as .ai() — future convenience wrapper
signalwire.core.swml_builder.SWMLBuilder.hangup: not_yet_implemented: same as .ai() — future convenience wrapper
signalwire.core.swml_builder.SWMLBuilder.play: not_yet_implemented: same as .ai() — future convenience wrapper
signalwire.core.swml_renderer.SwmlRenderer: deliberately omitted: TS folds SWML rendering into AgentBase.renderSwml() / SWMLService.render() — no free-standing SwmlRenderer class needed
signalwire.core.swml_renderer.SwmlRenderer.render_function_response_swml: deliberately omitted: see SwmlRenderer rationale
signalwire.core.swml_renderer.SwmlRenderer.render_swml: deliberately omitted: see SwmlRenderer rationale
signalwire.relay.call.Call.pass_: deliberately omitted: Python uses `pass_` because `pass` is a reserved word; TS uses `pass()` directly which maps to `pass` in Python (enumerator emits it under the TS name)
signalwire.rest._base.SignalWireRestError: TS consolidates to a single RestError class exported from @signalwire/sdk; SignalWireRestError is an alias that diverges only by class name
signalwire.rest._base.SignalWireRestError.__init__: see SignalWireRestError rationale
signalwire.rest._pagination.PaginatedIterator: TS uses the paginate() / paginateAll() async generator helpers instead of a class-based iterator (functionally equivalent; more idiomatic for JS)
signalwire.rest._pagination.PaginatedIterator.__init__: see PaginatedIterator rationale
signalwire.rest.call_handler.PhoneCallHandler: TS exports PhoneCallHandler as a string literal type rather than a Python-style enum class; the value set (flow, cxml, webhook, relay) is the same
signalwire.rest.namespaces.fabric.AutoMaterializedWebhook: deliberately omitted: TS uses the AutoMaterializedWebhookResource alias to avoid collision with the TS string literal type of the same idea; the Resource class covers the create() flow
signalwire.rest.namespaces.fabric.AutoMaterializedWebhook.create: see AutoMaterializedWebhook rationale
signalwire.skills.google_maps.skill.GoogleMapsClient: deliberately omitted: GoogleMapsClient is a Python-only helper class; TS GoogleMapsSkill calls the Maps HTTP API directly via fetch
signalwire.skills.google_maps.skill.GoogleMapsClient.__init__: see GoogleMapsClient rationale
signalwire.skills.google_maps.skill.GoogleMapsClient.compute_route: see GoogleMapsClient rationale
signalwire.skills.google_maps.skill.GoogleMapsClient.validate_address: see GoogleMapsClient rationale
signalwire.skills.mcp_gateway.skill.MCPGatewaySkill: TS spelling is McpGatewaySkill (camelCase initialism); TS diff enumerator records it under the TS name — see PORT_ADDITIONS.md
signalwire.skills.mcp_gateway.skill.MCPGatewaySkill.get_global_data: see MCPGatewaySkill rationale
signalwire.skills.mcp_gateway.skill.MCPGatewaySkill.get_hints: see MCPGatewaySkill rationale
signalwire.skills.mcp_gateway.skill.MCPGatewaySkill.get_parameter_schema: see MCPGatewaySkill rationale
signalwire.skills.mcp_gateway.skill.MCPGatewaySkill.get_prompt_sections: see MCPGatewaySkill rationale
signalwire.skills.mcp_gateway.skill.MCPGatewaySkill.setup: see MCPGatewaySkill rationale
signalwire.skills.swml_transfer.skill.SWMLTransferSkill: TS spelling is SwmlTransferSkill (camelCase); see PORT_ADDITIONS.md for the port-side alias
signalwire.skills.swml_transfer.skill.SWMLTransferSkill.get_hints: see SWMLTransferSkill rationale
signalwire.skills.swml_transfer.skill.SWMLTransferSkill.get_instance_key: see SWMLTransferSkill rationale
signalwire.skills.swml_transfer.skill.SWMLTransferSkill.get_parameter_schema: see SWMLTransferSkill rationale
signalwire.skills.swml_transfer.skill.SWMLTransferSkill.get_prompt_sections: see SWMLTransferSkill rationale
signalwire.skills.swml_transfer.skill.SWMLTransferSkill.setup: see SWMLTransferSkill rationale
signalwire.skills.web_search.skill.GoogleSearchScraper: deliberately omitted: Python Google-scrape helper class; TS WebSearchSkill uses the official Google Custom Search API via fetch and does not scrape HTML directly
signalwire.skills.web_search.skill.GoogleSearchScraper.__init__: see GoogleSearchScraper rationale
signalwire.skills.web_search.skill.GoogleSearchScraper.extract_html_content: see GoogleSearchScraper rationale
signalwire.skills.web_search.skill.GoogleSearchScraper.extract_reddit_content: see GoogleSearchScraper rationale
signalwire.skills.web_search.skill.GoogleSearchScraper.extract_text_from_url: see GoogleSearchScraper rationale
signalwire.skills.web_search.skill.GoogleSearchScraper.is_reddit_url: see GoogleSearchScraper rationale
signalwire.skills.web_search.skill.GoogleSearchScraper.search_and_scrape: see GoogleSearchScraper rationale
signalwire.skills.web_search.skill.GoogleSearchScraper.search_and_scrape_best: see GoogleSearchScraper rationale
signalwire.skills.web_search.skill.GoogleSearchScraper.search_google: see GoogleSearchScraper rationale
signalwire.utils.is_serverless_mode: TS uses ServerlessAdapter.detectPlatform() instead (returns "lambda" | "gcf" | "azure" | null); boolean helper not needed
signalwire.utils.schema_utils.SchemaUtils.full_validation_available: deliberately omitted: Python boolean flag indicating whether jsonschema is installed; TS always has Ajv, so the flag is always true
signalwire.utils.schema_utils.SchemaUtils.generate_method_body: deliberately omitted: Python code-generation helper used by generateVerbTypes.ts; TS emits the generated file directly rather than via a SchemaUtils method
signalwire.utils.schema_utils.SchemaUtils.generate_method_signature: deliberately omitted: see generate_method_body rationale
signalwire.utils.schema_utils.SchemaUtils.get_all_verb_names: not_yet_implemented: trivial convenience accessor; can be added in a follow-up
signalwire.utils.schema_utils.SchemaUtils.get_verb_parameters: not_yet_implemented: convenience accessor; add when needed
signalwire.utils.schema_utils.SchemaUtils.load_schema: TS SchemaUtils loads schema in the constructor (see SchemaUtils constructor); no separate load_schema classmethod needed
signalwire.utils.schema_utils.SchemaUtils.validate_document: TS SchemaUtils uses validate() which takes the same shape (string | object); method name differs
signalwire.utils.schema_utils.SchemaValidationError: TS uses plain Error subclasses; no dedicated SchemaValidationError class needed — see PORT_ADDITIONS.md for RestError / AjvError equivalents
signalwire.utils.schema_utils.SchemaValidationError.__init__: see SchemaValidationError rationale
signalwire.utils.url_validator.validate_url: TS validateUrl lives in SecurityUtils, not in a separate url_validator module — see PORT_ADDITIONS.md

## ToolMixin / ToolRegistry (Python uses mixin pattern — TS uses direct methods on SWMLService)

signalwire.core.agent.tools.registry.ToolRegistry.register_swaig_function: TS folds tool registration into SWMLService.register_swaig_function (see PORT_ADDITIONS.md SWMLService entry); no separate ToolRegistry class
signalwire.core.mixins.tool_mixin.ToolMixin.register_swaig_function: TS folds tool registration into SWMLService.register_swaig_function; the Python ToolMixin pattern is replaced by direct methods on SWMLService

## Hono `app` accessor / Python `logger` instance attributes

Python exposes `self.app` (a Flask/FastAPI WSGI app) and `self.logger`
as public instance attributes; the TS port surfaces both via differently
named accessors (`getApp()` and `log` getter respectively) so the Python
attribute names appear missing from the TS surface.

signalwire.agent_server.AgentServer.app: TS exposes the underlying Hono app via `getApp()` getter (see PORT_ADDITIONS.md AgentServer.get_app); the bare `app` attribute name is not used in TS
signalwire.agent_server.AgentServer.logger: TS uses `log` getter exposing the same logger instance (see PORT_ADDITIONS.md AgentServer.log); the Python `logger` attribute name is not used in TS
signalwire.core.skill_manager.SkillManager.logger: TS instantiates a per-instance Logger via `getLogger()` directly inside methods rather than exposing it as a public instance attribute; Python's pattern is `self.logger = logging.getLogger(...)` which the adapter sees as a public attribute
signalwire.skills.registry.SkillRegistry.logger: TS uses `getLogger('SkillRegistry')` calls inline rather than caching as a public attribute on the singleton; Python's adapter reports `self.logger` as a public state attribute
signalwire.web.web_service.WebService.app: TS WebService exposes the Hono app via `getApp()` getter (see PORT_ADDITIONS.md WebService.get_app); the bare `app` attribute name is not used in TS
signalwire.web.web_service.WebService.security: TS WebService exposes the SslConfig via `ssl_config` accessor (see PORT_ADDITIONS.md WebService.ssl_config); the Python `security` attribute name is not used in TS

## SWMLService.on_request (default no-op; subclass-overridable hook)

signalwire.core.swml_service.SWMLService.on_request: Python declares `on_request` as a default no-op on SWMLService that subclasses override; TS only declares the override on AgentBase via WebMixin projection — equivalent functionality is reachable through `agent.onRequest(...)`, but the bare declaration on SWMLService is not surfaced
