# EXAMPLES_RUN allowlist (typescript)

Examples listed here are skipped by the EXAMPLES-RUN gate (`scripts/examples_run.py`)
because they legitimately require real credentials, external network services,
optional third-party API keys, or a mandatory runtime env var that has no mock —
they cannot run to completion against the shared REST/RELAY mock alone. Each entry
states the concrete reason and the date it was added. These are NOT example defects.

Format: `- <path> — <reason>` (date).

## Skill examples requiring real provider credentials / config

- examples/datasphere.ts — DataSphereSkill.setup() fails-loud on missing required params (space_name, project_id, token, document_id); needs a real SignalWire DataSphere knowledge base (2026-07-09).
- examples/datasphere-serverless-env.ts — requires SIGNALWIRE_SPACE, SIGNALWIRE_PROJECT_ID, SIGNALWIRE_TOKEN, DATASPHERE_DOCUMENT_ID env vars for a real DataSphere document (2026-07-09).
- examples/datasphere-webhook-env.ts — same real-DataSphere env-var requirement as datasphere-serverless-env.ts (2026-07-09).
- examples/web-search.ts — WebSearchSkill requires GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_ENGINE_ID (real Google Programmable Search creds) (2026-07-09).
- examples/web-search-multi-instance.ts — same `GOOGLE_SEARCH_*` real-creds requirement as web-search.ts (2026-07-09).
- examples/mcp-gateway.ts — McpGatewaySkill requires auth_token or (auth_user + auth_password) for a real MCP gateway endpoint (2026-07-09).

## Real-network / real-creds runnable examples

- examples/quickstart-rest.ts — README-INCLUDE fixture that constructs a RestClient and issues a live HTTPS request; with placeholder project/token it returns 401 from the real host (2026-07-09).

## Audit harnesses (env-var-driven internal tooling, not standalone demos)

- examples/rest_audit_harness.ts — requires REST_OPERATION env var; a parametrized harness driven by the enumerate/coverage tooling, not a runnable demo (2026-07-09).
- examples/skills_audit_harness.ts — requires SKILL_NAME env var; parametrized skills-audit harness, not a runnable demo (2026-07-09).
- examples/relay_audit_harness.ts — connects to a real RELAY endpoint with credentials (fails 401 against the public host); an audit harness, not a mockable demo (2026-07-09).
