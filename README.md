<!-- Header -->
<div align="center">
    <a href="https://signalwire.com" target="_blank">
        <img src="https://github.com/user-attachments/assets/0c8ed3b9-8c50-4dc6-9cc4-cc6cd137fd50" width="500" />
    </a>

# SignalWire SDK for TypeScript

_Build AI voice agents, control live calls over WebSocket, and manage every SignalWire resource over REST -- all from one package._

<p align="center">
  <a href="https://developer.signalwire.com/sdks/agents-sdk" target="_blank">Documentation</a> &middot;
  <a href="https://github.com/signalwire/signalwire-docs/issues/new/choose" target="_blank">Report an Issue</a> &middot;
  <a href="https://www.npmjs.com/package/@signalwire/sdk" target="_blank">npm</a>
</p>

<a href="https://discord.com/invite/F2WNYTNjuF" target="_blank"><img src="https://img.shields.io/badge/Discord%20Community-5865F2" alt="Discord" /></a>
<a href="LICENSE"><img src="https://img.shields.io/badge/MIT-License-blue" alt="MIT License" /></a>
<a href="https://github.com/signalwire/signalwire-typescript" target="_blank"><img src="https://img.shields.io/github/stars/signalwire/signalwire-typescript" alt="GitHub Stars" /></a>

</div>

---

## What's in this SDK

| Capability | What it does | Quick link |
|-----------|-------------|------------|
| **AI Agents** | Build voice agents that handle calls autonomously -- the platform runs the AI pipeline, your code defines the persona, tools, and call flow | [Agent Guide](#ai-agents) |
| **RELAY Client** | Control live calls and SMS/MMS in real time over WebSocket -- answer, play, record, collect DTMF, conference, transfer, and more | [RELAY docs](relay/README.md) |
| **REST Client** | Manage SignalWire resources over HTTP -- phone numbers, SIP endpoints, Fabric AI agents, video rooms, messaging, and 17+ API namespaces | [REST docs](rest/README.md) |

```bash
npm install @signalwire/sdk
```

---

## AI Agents

Each agent is a self-contained microservice that generates [SWML](docs/swml_service_guide.md) (SignalWire Markup Language) and handles [SWAIG](docs/swaig-reference.md) (SignalWire AI Gateway) tool calls. The SignalWire platform runs the entire AI pipeline (STT, LLM, TTS) -- your agent just defines the behavior.

```typescript
import { AgentBase, FunctionResult } from '@signalwire/sdk';

const agent = new AgentBase({
  name: 'my-agent',
  route: '/agent',
});

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'inworld.Mark' });
agent.promptAddSection('Role', { body: 'You are a helpful assistant.' });

agent.defineTool({
  name: 'get_time',
  description: 'Get the current time',
  parameters: {},
  handler: () => new FunctionResult(`The time is ${new Date().toLocaleTimeString()}`),
});

agent.run(); // Starts HTTP server on port 3000
```

Test locally without running a server:

```bash
swaig-test examples/simple-agent.ts --list-tools
swaig-test examples/simple-agent.ts --dump-swml
swaig-test examples/simple-agent.ts --exec get_time
```

### Agent Features

- **Prompt Object Model (POM)** -- structured prompt composition via `promptAddSection()`
- **SWAIG tools** -- define functions with `defineTool()` that the AI calls mid-conversation, with native access to the call's media stack
- **Skills system** -- add capabilities with one-liners: `agent.addSkill('datetime')`
- **Contexts and steps** -- structured multi-step workflows with navigation control
- **DataMap tools** -- tools that execute on SignalWire's servers, calling REST APIs without your own webhook
- **Dynamic configuration** -- per-request agent customization for multi-tenant deployments
- **Call flow control** -- pre-answer, post-answer, and post-AI verb insertion
- **Prefab agents** -- ready-to-use archetypes (InfoGatherer, Survey, FAQ, Receptionist, Concierge)
- **Multi-agent hosting** -- serve multiple agents on a single server with `AgentServer`
- **SIP routing** -- route SIP calls to agents based on usernames
- **Session state** -- persistent conversation state with global data and post-prompt summaries
- **Security** -- auto-generated basic auth, function-specific HMAC tokens, SSL support
- **Serverless** -- auto-detects Lambda, CGI, Google Cloud Functions, Azure Functions

### Agent Examples

The [`examples/`](examples/) directory contains 35+ working examples:

| Example | What it demonstrates |
|---------|---------------------|
| [simple-agent.ts](examples/simple-agent.ts) | POM prompts, SWAIG tools, multilingual support, LLM tuning |
| [contexts-steps.ts](examples/contexts-steps.ts) | Multi-step workflow with context switching and step navigation |
| [datamap-tools.ts](examples/datamap-tools.ts) | Server-side API tools without webhooks |
| [skills-demo.ts](examples/skills-demo.ts) | Loading built-in skills (datetime, math) |
| [call-flow.ts](examples/call-flow.ts) | Call flow verbs, debug events, FunctionResult actions |
| [session-state.ts](examples/session-state.ts) | onSummary, global data, post-prompt summaries |
| [multi-agent.ts](examples/multi-agent.ts) | Multiple agents on one server |
| [serverless-lambda.ts](examples/serverless-lambda.ts) | AWS Lambda deployment |
| [dynamic-config.ts](examples/dynamic-config.ts) | Per-request dynamic configuration, multi-tenant routing |

---

## RELAY Client

Real-time call control and messaging over WebSocket. The RELAY client connects to SignalWire via the Blade protocol and gives you imperative, async control over live phone calls and SMS/MMS.

```typescript
import { RelayClient, Call } from '@signalwire/sdk';

const client = new RelayClient({
  contexts: ['default'],
});

client.onCall(async (call: Call) => {
  await call.answer();
  const action = await call.play([
    { type: 'tts', text: 'Welcome to SignalWire!' },
  ]);
  await action.wait();
  await call.hangup();
});

client.run();
```

- 40+ calling methods (play, record, collect, detect, tap, stream, AI, conferencing, and more)
- SMS/MMS messaging with delivery tracking
- Action objects with `wait()`, `stop()`, `pause()`, `resume()`
- Auto-reconnect with exponential backoff

See the **[RELAY documentation](relay/README.md)** for the full guide, API reference, and examples.

---

## REST Client

Typed HTTP client for managing SignalWire resources and controlling calls over HTTP. No WebSocket required -- just standard `fetch` requests.

```typescript
import { RestClient } from '@signalwire/sdk';

const client = new RestClient({
  project: '...',
  token: '...',
  host: 'example.signalwire.com',
});

await client.fabric.aiAgents.create({ name: 'Support Bot', prompt: { text: 'You are helpful.' } });
await client.calling.play(callId, { play: [{ type: 'tts', text: 'Hello!' }] });
await client.phoneNumbers.search({ area_code: '512' });
await client.datasphere.documents.search({ query_string: 'billing policy' });
```

- 17 namespaced API surfaces: Fabric (17 resource types), Calling (37 commands), Video, Datasphere, Compat (Twilio-compatible), Phone Numbers, SIP, Queues, Recordings, and more
- Zero dependencies -- uses built-in `fetch` (Node 18+)
- Dict returns -- raw JSON, no wrapper objects

See the **[REST documentation](rest/README.md)** for the full guide, API reference, and examples.

---

## Installation

```bash
# Core SDK (agents, RELAY, REST)
npm install @signalwire/sdk
```

Requires Node.js >= 18.

## Documentation

Full reference documentation is available at **[developer.signalwire.com/sdks/agents-sdk](https://developer.signalwire.com/sdks/agents-sdk)**.

Guides are also available in the [`docs/`](docs/) directory:

### Getting Started

- [Agent Guide](docs/agent-guide.md) -- creating agents, prompt configuration, dynamic setup
- [Architecture](docs/architecture.md) -- SDK architecture and core concepts
- [SDK Features](docs/sdk_features.md) -- feature overview, SDK vs raw SWML comparison

### Core Features

- [SWAIG Reference](docs/swaig-reference.md) -- function results, actions, post_data lifecycle
- [Contexts and Steps](docs/contexts-guide.md) -- structured workflows, navigation, gather mode
- [DataMap Guide](docs/datamap-guide.md) -- serverless API tools without webhooks
- [LLM Parameters](docs/llm_parameters.md) -- temperature, top_p, barge confidence tuning
- [SWML Service Guide](docs/swml_service_guide.md) -- low-level construction of SWML documents

### Skills and Extensions

- [Skills System](docs/skills-guide.md) -- built-in skills and the modular framework
- [Third-Party Skills](docs/third_party_skills.md) -- creating and publishing custom skills
- [MCP Gateway](docs/mcp_gateway_reference.md) -- Model Context Protocol integration
- [MCP Integration](docs/mcp_integration.md) -- MCP agent setup and configuration

### Deployment

- [CLI Guide](docs/cli-guide.md) -- `swaig-test` command reference
- [Cloud Functions](docs/cloud_functions_guide.md) -- Lambda, Cloud Functions, Azure deployment
- [Serverless Guide](docs/serverless-guide.md) -- deploy to AWS Lambda, Google Cloud Functions, Azure Functions, CGI
- [Configuration](docs/configuration.md) -- environment variables, SSL, proxy setup
- [Security](docs/security.md) -- authentication and security model

### Reference

- [API Reference](docs/api-reference.md) -- complete class and method reference
- [Web Service](docs/web_service.md) -- HTTP server and endpoint details
- [Skills Parameter Schema](docs/skills_parameter_schema.md) -- skill parameter definitions
- [Prefabs Guide](docs/prefabs-guide.md) -- pre-built agents: InfoGatherer, Survey, FAQ, Concierge, Receptionist
- [Migration Guide](docs/MIGRATION-2.0.md) -- upgrading to SDK 2.0

## Environment Variables

| Variable | Used by | Description |
|----------|---------|-------------|
| `SIGNALWIRE_PROJECT_ID` | RELAY, REST | Project identifier |
| `SIGNALWIRE_API_TOKEN` | RELAY, REST | API token |
| `SIGNALWIRE_SPACE` | RELAY, REST | Space hostname (e.g. `example.signalwire.com`) |
| `SWML_BASIC_AUTH_USER` | Agents | Basic auth username (default: auto-generated) |
| `SWML_BASIC_AUTH_PASSWORD` | Agents | Basic auth password (default: auto-generated) |
| `SWML_PROXY_URL_BASE` | Agents | Base URL when behind a reverse proxy |
| `SWML_SSL_ENABLED` | Agents | Enable HTTPS (`true`, `1`, `yes`) |
| `SWML_SSL_CERT_PATH` | Agents | Path to SSL certificate |
| `SWML_SSL_KEY_PATH` | Agents | Path to SSL private key |
| `SIGNALWIRE_LOG_LEVEL` | All | Logging level (`debug`, `info`, `warn`, `error`) |
| `SIGNALWIRE_LOG_MODE` | All | Set to `off` to suppress all logging |

## Testing

```bash
# Install dependencies
npm install

# Run the test suite
npm test

# Watch mode
npm run test:watch

# Build
npm run build

# Dev mode (watch + rebuild)
npm run dev
```

### Contributing Changes

This project uses [changesets](https://github.com/changesets/changesets) to manage versioning and changelogs. Every pull request that changes runtime behavior must include a changeset.

**Adding a changeset:**

```bash
npx changeset
```

You'll be prompted to:

1. Select the package (`signalwire-agents`)
2. Choose the semver bump type:
   - **patch** — bug fixes, internal changes
   - **minor** — new features, non-breaking additions
   - **major** — breaking API changes
3. Write a short summary of your changes

This creates a markdown file in `.changeset/` that should be committed with your PR. The CI pipeline will fail if a changeset is missing.

**What happens after your PR merges:**

1. A "Release PR" is automatically created (or updated) with the version bump and changelog entry
2. When the team merges the Release PR, the package is published to npm and a GitHub Release is created

## License

MIT -- see [LICENSE](LICENSE) for details.
