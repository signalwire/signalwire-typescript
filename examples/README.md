# Examples

TypeScript examples demonstrating the SignalWire AI Agents SDK. Each example can be run with `npx tsx`.

## Agent Examples

| File | Description |
|------|-------------|
| [simple-agent.ts](simple-agent.ts) | Minimal agent with prompt, hints, language, and a tool |
| [simple-static.ts](simple-static.ts) | Static agent with voice, params, and structured prompts |
| [dynamic-config.ts](dynamic-config.ts) | Per-request dynamic configuration callback |
| [advanced-dynamic-config.ts](advanced-dynamic-config.ts) | Advanced dynamic config with tier selection |
| [comprehensive-dynamic.ts](comprehensive-dynamic.ts) | Tier-based dynamic config with industry prompts, A/B testing |
| [declarative.ts](declarative.ts) | Declarative prompt sections with tools and post-prompt |
| [custom-path.ts](custom-path.ts) | Agent on a custom HTTP path with query-param personalization |
| [multi-agent.ts](multi-agent.ts) | Multiple agents on different routes via AgentServer |
| [multi-endpoint.ts](multi-endpoint.ts) | Single agent with multiple SWML routes alongside /health |
| [pom-prompt.ts](pom-prompt.ts) | Prompt Object Model sections and structured prompts |

## Contexts, Steps, and Gather Info

| File | Description |
|------|-------------|
| [contexts-steps.ts](contexts-steps.ts) | Multi-step workflows using contexts and steps |
| [gather-info.ts](gather-info.ts) | GatherInfo with typed questions for data collection |

## DataMap (Server-Side Tools)

| File | Description |
|------|-------------|
| [datamap-tools.ts](datamap-tools.ts) | Server-side DataMap tools (weather API, calculator) |
| [advanced-datamap.ts](advanced-datamap.ts) | Advanced DataMap: expressions, webhooks, foreach |

## Skills

| File | Description |
|------|-------------|
| [skills-demo.ts](skills-demo.ts) | Built-in skills: datetime, math |
| [web-search.ts](web-search.ts) | Web search skill via Google Custom Search API |
| [web-search-multi-instance.ts](web-search-multi-instance.ts) | Multiple web search instances (general, news, quick) |
| [wikipedia.ts](wikipedia.ts) | Wikipedia search skill for factual retrieval |
| [datasphere.ts](datasphere.ts) | DataSphere skill for knowledge base search |
| [datasphere-multi-instance.ts](datasphere-multi-instance.ts) | Multiple DataSphere instances for separate knowledge bases |
| [datasphere-serverless-env.ts](datasphere-serverless-env.ts) | DataSphere serverless from environment variables |
| [datasphere-webhook-env.ts](datasphere-webhook-env.ts) | DataSphere webhook from environment variables |
| [mcp-agent.ts](mcp-agent.ts) | MCP client integration for Model Context Protocol |
| [mcp-gateway.ts](mcp-gateway.ts) | MCP gateway skill for bridging MCP server tools |

## SWAIG Features and FunctionResult Actions

| File | Description |
|------|-------------|
| [swaig-features.ts](swaig-features.ts) | FunctionResult actions: connect, hangup, hold, say, metadata |
| [joke-agent.ts](joke-agent.ts) | Raw data_map configuration (API Ninjas jokes) |
| [record-call.ts](record-call.ts) | Start/stop call recording via FunctionResult |
| [room-and-sip.ts](room-and-sip.ts) | Room joining, SIP REFER, and conferences |
| [tap.ts](tap.ts) | TAP configuration for WebSocket/RTP media monitoring |

## Call Flow and AI Configuration

| File | Description |
|------|-------------|
| [call-flow.ts](call-flow.ts) | 5-phase call flow with pre/post answer verbs |
| [llm-params.ts](llm-params.ts) | LLM parameter tuning (precise, creative, customer service) |
| [session-state.ts](session-state.ts) | Global data, session tracking, and on_summary callback |
| [verb-methods.ts](verb-methods.ts) | SWML verb methods for building SWML documents |

## Prefab Agents

| File | Description |
|------|-------------|
| [prefab-info-gatherer.ts](prefab-info-gatherer.ts) | InfoGatherer prefab for structured data collection |
| [dynamic-info-gatherer.ts](dynamic-info-gatherer.ts) | Dynamic InfoGatherer with callback-based question selection |
| [prefab-survey.ts](prefab-survey.ts) | Survey prefab with typed questions and validation |
| [prefab-concierge.ts](prefab-concierge.ts) | Concierge prefab for venue amenities and services |
| [prefab-faq.ts](prefab-faq.ts) | FAQ bot prefab with keyword-based lookup |
| [prefab-receptionist.ts](prefab-receptionist.ts) | Receptionist prefab with department routing |

## SWML Service (Non-AI)

| File | Description |
|------|-------------|
| [swml-service.ts](swml-service.ts) | Basic SWML service: voicemail, IVR, recording |
| [dynamic-swml-service.ts](dynamic-swml-service.ts) | Dynamic SWML generation based on request data |
| [swml-service-routing.ts](swml-service-routing.ts) | Path-based routing with multiple SWML sections |
| [auto-vivified.ts](auto-vivified.ts) | Auto-vivified verb methods on SWMLService |

## Deployment

| File | Description |
|------|-------------|
| [kubernetes-agent.ts](kubernetes-agent.ts) | K8s-ready agent with /health, /ready endpoints |
| [serverless-lambda.ts](serverless-lambda.ts) | Serverless pattern for AWS Lambda deployment |

## Client Examples

| File | Description |
|------|-------------|
| [relay-demo.ts](relay-demo.ts) | RELAY WebSocket client: answer calls, play TTS |

## Running Examples

```bash
# Run any example
npx tsx examples/simple-agent.ts

# For skill examples that need API keys:
GOOGLE_SEARCH_API_KEY=your-key GOOGLE_SEARCH_CX=your-cx npx tsx examples/web-search.ts
API_NINJAS_KEY=your-key npx tsx examples/joke-agent.ts

# For RELAY/DataSphere examples:
export SIGNALWIRE_PROJECT_ID=your-project-id
export SIGNALWIRE_API_TOKEN=your-api-token
export SIGNALWIRE_SPACE=your-space.signalwire.com
npx tsx examples/relay-demo.ts
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SWML_BASIC_AUTH_USER` | Override auth username | `user` |
| `SWML_BASIC_AUTH_PASSWORD` | Override auth password | `pass` |
| `SIGNALWIRE_PROJECT_ID` | Project ID (RELAY/DataSphere) | - |
| `SIGNALWIRE_API_TOKEN` | API token (RELAY/DataSphere) | - |
| `SIGNALWIRE_SPACE` | Space hostname | - |
| `API_NINJAS_KEY` | API Ninjas key (joke agent) | - |
| `GOOGLE_SEARCH_API_KEY` | Google Custom Search key | - |
| `GOOGLE_SEARCH_CX` | Google Search Engine ID | - |
| `DATASPHERE_DOCUMENT_ID` | DataSphere document ID | - |
| `MCP_GATEWAY_URL` | MCP gateway service URL | - |
