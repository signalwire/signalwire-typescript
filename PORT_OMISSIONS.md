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

signalwire.search.document_processor.DocumentProcessor: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.document_processor.DocumentProcessor.__init__: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.document_processor.DocumentProcessor.create_chunks: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.index_builder.IndexBuilder: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.index_builder.IndexBuilder.__init__: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.index_builder.IndexBuilder.build_index: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.index_builder.IndexBuilder.build_index_from_sources: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.index_builder.IndexBuilder.validate_index: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.migration.SearchIndexMigrator: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.migration.SearchIndexMigrator.__init__: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.migration.SearchIndexMigrator.get_index_info: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.migration.SearchIndexMigrator.migrate_pgvector_to_sqlite: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.migration.SearchIndexMigrator.migrate_sqlite_to_pgvector: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.models.resolve_model_alias: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.pgvector_backend.PgVectorBackend: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.pgvector_backend.PgVectorBackend.__init__: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.pgvector_backend.PgVectorBackend.close: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.pgvector_backend.PgVectorBackend.create_schema: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.pgvector_backend.PgVectorBackend.delete_collection: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.pgvector_backend.PgVectorBackend.get_stats: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.pgvector_backend.PgVectorBackend.list_collections: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.pgvector_backend.PgVectorBackend.store_chunks: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.pgvector_backend.PgVectorSearchBackend: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.pgvector_backend.PgVectorSearchBackend.__init__: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.pgvector_backend.PgVectorSearchBackend.close: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.pgvector_backend.PgVectorSearchBackend.fetch_candidates: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.pgvector_backend.PgVectorSearchBackend.get_stats: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.pgvector_backend.PgVectorSearchBackend.search: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.query_processor.detect_language: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.query_processor.ensure_nltk_resources: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.query_processor.get_synonyms: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.query_processor.get_wordnet_pos: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.query_processor.load_spacy_model: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.query_processor.preprocess_document_content: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.query_processor.preprocess_query: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.query_processor.remove_duplicate_words: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.query_processor.set_global_model: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.query_processor.vectorize_query: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.search_engine.SearchEngine: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.search_engine.SearchEngine.__init__: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.search_engine.SearchEngine.get_stats: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.search_engine.SearchEngine.search: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.search_service.SearchService: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.search_service.SearchService.__init__: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.search_service.SearchService.search_direct: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.search_service.SearchService.start: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.search.search_service.SearchService.stop: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass

## Bedrock (AWS-specific agent)

# BedrockAgent is now IMPLEMENTED as a real TS AgentBase subclass in
# src/agents/BedrockAgent.ts (class + __init__ + the 6 setters), mirroring the
# Python prefab. Those symbols are PRESENT in port_surface.json and compare
# equal — they are no longer omitted. Only __repr__ (Python object protocol)
# remains omitted, under the "Python dunder methods" section below with an
# `impossible:` reason.

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

signalwire.cli.build_search.console_entry_point: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.cli.build_search.main: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.cli.build_search.migrate_command: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.cli.build_search.remote_command: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.cli.build_search.search_command: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.cli.build_search.validate_command: approved: Python-only RAG / vector-search subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass

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

signalwire.cli.swaig_test_wrapper.main: Python's argparse CLI entry-point plumbing; the TS SDK ships its own `bin/swaig-test` (src/cli/swaig-test.ts, exposed via package.json `bin`) with the equivalent CLI surface (--dump-swml / --list-tools / --exec), so the Python wrapper module has no TS analog.
signalwire.cli.test_swaig.console_entry_point: Python's argparse CLI entry-point plumbing; the TS SDK ships its own `bin/swaig-test` (src/cli/swaig-test.ts, exposed via package.json `bin`) with the equivalent CLI surface (--dump-swml / --list-tools / --exec), so the Python wrapper module has no TS analog.
signalwire.cli.test_swaig.main: Python's argparse CLI entry-point plumbing; the TS SDK ships its own `bin/swaig-test` (src/cli/swaig-test.ts, exposed via package.json `bin`) with the equivalent CLI surface (--dump-swml / --list-tools / --exec), so the Python wrapper module has no TS analog.
signalwire.cli.test_swaig.print_help_examples: Python's argparse CLI entry-point plumbing; the TS SDK ships its own `bin/swaig-test` (src/cli/swaig-test.ts, exposed via package.json `bin`) with the equivalent CLI surface (--dump-swml / --list-tools / --exec), so the Python wrapper module has no TS analog.
signalwire.cli.test_swaig.print_help_platforms: Python's argparse CLI entry-point plumbing; the TS SDK ships its own `bin/swaig-test` (src/cli/swaig-test.ts, exposed via package.json `bin`) with the equivalent CLI surface (--dump-swml / --list-tools / --exec), so the Python wrapper module has no TS analog.

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

signalwire.mcp_gateway.gateway_service.MCPGateway: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.gateway_service.MCPGateway.__init__: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.gateway_service.MCPGateway.run: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.gateway_service.MCPGateway.shutdown: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.gateway_service.main: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.mcp_manager.MCPClient: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.mcp_manager.MCPClient.__init__: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.mcp_manager.MCPClient.call_method: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.mcp_manager.MCPClient.call_tool: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.mcp_manager.MCPClient.get_tools: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.mcp_manager.MCPClient.start: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.mcp_manager.MCPClient.stop: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.mcp_manager.MCPManager: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.mcp_manager.MCPManager.__init__: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.mcp_manager.MCPManager.create_client: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.mcp_manager.MCPManager.get_service: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.mcp_manager.MCPManager.get_service_tools: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.mcp_manager.MCPManager.list_services: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.mcp_manager.MCPManager.shutdown: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.mcp_manager.MCPManager.validate_services: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.mcp_manager.MCPService: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.mcp_manager.MCPService.__hash__: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.mcp_manager.MCPService.__post_init__: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.session_manager.Session: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.session_manager.Session.is_alive: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.session_manager.Session.is_expired: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.session_manager.Session.touch: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.session_manager.SessionManager: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.session_manager.SessionManager.__init__: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.session_manager.SessionManager.close_session: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.session_manager.SessionManager.create_session: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.session_manager.SessionManager.get_service_session_count: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.session_manager.SessionManager.get_session: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.session_manager.SessionManager.list_sessions: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.mcp_gateway.session_manager.SessionManager.shutdown: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass

## Mixin class identifiers (folded into AgentBase in TS)

signalwire.core.mixins.tool_mixin.ToolMixin.tool: impossible: Python @tool class/instance decorator API; TS registers tools via defineTools()/the tool builder — no decorator-based registration equivalent

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

signalwire.skills.mcp_gateway.skill.MCPGatewaySkill.register_tools: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.skills.web_search.skill_improved.WebSearchSkill.register_tools: TS SkillBase handles tool registration automatically inside addSkill() via the getTools() contract; concrete skills do not need to expose a separate register_tools hook
signalwire.skills.web_search.skill_original.WebSearchSkill.register_tools: TS SkillBase handles tool registration automatically inside addSkill() via the getTools() contract; concrete skills do not need to expose a separate register_tools hook

# Prefab tool-handler methods are now REFACTORED from inline closures into named
# class methods (checkAvailability / getDirections / searchFaqs / startQuestions /
# submitAnswer / logResponse / validateResponse), each registered via
# `handler: this.<method>.bind(this)`. They are PRESENT in port_surface.json and
# compare equal to the Python prefab handlers — no longer omitted.

## Python dunder methods (no TS equivalent)

signalwire.agents.bedrock.BedrockAgent.__repr__: impossible: Python __repr__ object-protocol; TS has no stringification-protocol member enumerated on the surface
signalwire.cli.simulation.mock_env.MockHeaders.__contains__: Python-specific dunder method with no idiomatic TS equivalent (constructor, iterator, context-manager, and stringification protocols are handled by built-in TS features)
signalwire.cli.simulation.mock_env.MockHeaders.__getitem__: Python-specific dunder method with no idiomatic TS equivalent (constructor, iterator, context-manager, and stringification protocols are handled by built-in TS features)
signalwire.cli.simulation.mock_env.MockQueryParams.__contains__: Python-specific dunder method with no idiomatic TS equivalent (constructor, iterator, context-manager, and stringification protocols are handled by built-in TS features)
signalwire.cli.simulation.mock_env.MockQueryParams.__getitem__: Python-specific dunder method with no idiomatic TS equivalent (constructor, iterator, context-manager, and stringification protocols are handled by built-in TS features)
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
signalwire.rest.namespaces.fabric.AutoMaterializedWebhook: deliberately omitted: TS uses the AutoMaterializedWebhookResource alias to avoid collision with the TS string literal type of the same idea; the Resource class covers the create() flow
signalwire.rest.namespaces.fabric.AutoMaterializedWebhook.create: see AutoMaterializedWebhook rationale
signalwire.skills.google_maps.skill.GoogleMapsClient: deliberately omitted: GoogleMapsClient is a Python-only helper class; TS GoogleMapsSkill calls the Maps HTTP API directly via fetch
signalwire.skills.google_maps.skill.GoogleMapsClient.__init__: see GoogleMapsClient rationale
signalwire.skills.google_maps.skill.GoogleMapsClient.compute_route: see GoogleMapsClient rationale
signalwire.skills.google_maps.skill.GoogleMapsClient.validate_address: see GoogleMapsClient rationale
signalwire.skills.mcp_gateway.skill.MCPGatewaySkill: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.skills.mcp_gateway.skill.MCPGatewaySkill.get_global_data: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.skills.mcp_gateway.skill.MCPGatewaySkill.get_hints: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.skills.mcp_gateway.skill.MCPGatewaySkill.get_parameter_schema: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.skills.mcp_gateway.skill.MCPGatewaySkill.get_prompt_sections: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.skills.mcp_gateway.skill.MCPGatewaySkill.setup: approved: Python-only MCP gateway subsystem, intentionally not ported to any SDK — user sign-off 2026-07 pass
signalwire.skills.web_search.skill.GoogleSearchScraper: deliberately omitted: Python Google-scrape helper class; TS WebSearchSkill uses the official Google Custom Search API via fetch and does not scrape HTML directly
signalwire.skills.web_search.skill.GoogleSearchScraper.__init__: see GoogleSearchScraper rationale
signalwire.skills.web_search.skill.GoogleSearchScraper.extract_html_content: see GoogleSearchScraper rationale
signalwire.skills.web_search.skill.GoogleSearchScraper.extract_reddit_content: see GoogleSearchScraper rationale
signalwire.skills.web_search.skill.GoogleSearchScraper.extract_text_from_url: see GoogleSearchScraper rationale
signalwire.skills.web_search.skill.GoogleSearchScraper.is_reddit_url: see GoogleSearchScraper rationale
signalwire.skills.web_search.skill.GoogleSearchScraper.search_and_scrape: see GoogleSearchScraper rationale
signalwire.skills.web_search.skill.GoogleSearchScraper.search_and_scrape_best: see GoogleSearchScraper rationale
signalwire.skills.web_search.skill.GoogleSearchScraper.search_google: see GoogleSearchScraper rationale
signalwire.utils.schema_utils.SchemaUtils.generate_method_body: impossible: Python build-time codegen that generates SWML verb-method stubs from schema; TS's verb methods are hand-written/declaration-merged — no runtime method-source generation
signalwire.utils.schema_utils.SchemaUtils.generate_method_signature: impossible: Python build-time codegen that generates SWML verb-method stubs from schema; TS's verb methods are hand-written/declaration-merged — no runtime method-source generation
signalwire.utils.schema_utils.SchemaValidationError: impossible: TS returns a ValidationResult (SchemaUtils.validate → { valid, errors }), no exception class
signalwire.utils.schema_utils.SchemaValidationError.__init__: impossible: TS returns a ValidationResult (SchemaUtils.validate → { valid, errors }), no exception class to construct

## ToolMixin / ToolRegistry (Python uses mixin pattern — TS uses direct methods on SWMLService)


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

signalwire.agent_server.AgentServer.agents: Python exposes `agents` as a public dict attribute; TS keeps the map private (`private agents: Map<string, AgentBase>`) and exposes it via the `getAgents()` accessor (idiomatic TS private-field + accessor). Same registry, not a public field.
