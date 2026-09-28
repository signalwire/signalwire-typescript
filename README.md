<!-- Header -->
<div align="center">
    <a href="https://signalwire.com" target="_blank">
        <img src="https://github.com/user-attachments/assets/0c8ed3b9-8c50-4dc6-9cc4-cc6cd137fd50" width="500" />
    </a>

# SignalWire SDK for TypeScript

_Build AI voice agents, control live calls over WebSocket, and manage every SignalWire resource over REST, all from one package._

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

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module (top-level await)
declare global {
  const callId: string;
  const signingKey: string;
  const signatureHeader: string;
  const fullUrl: string;
  const rawBodyString: string;
  const requestParams: Record<string, string>;
}
```

## What's in this SDK

| Capability | What it does | Quick link |
|-----------|-------------|------------|
| **AI Agents** | Build voice agents that handle calls on their own. The platform runs the AI pipeline, and your code defines the persona, tools, and call flow. | [Agent Guide](#ai-agents) |
| **RELAY Client** | Control live calls and SMS/MMS in real time over WebSocket: answer, play, record, collect DTMF, conference, transfer, and more | [RELAY docs](relay/README.md) |
| **REST Client** | Manage SignalWire resources over HTTP: phone numbers, SIP endpoints, Fabric AI agents, video rooms, messaging, and the other REST API namespaces | [REST docs](rest/README.md) |

Install the SDK from npm:

```bash
npm install @signalwire/sdk
```

---

## AI Agents

Each agent is a self-contained microservice that generates [SWML](docs/swml_service_guide.md) (SignalWire Markup Language) and handles [SWAIG](docs/swaig-reference.md) (SignalWire AI Gateway) tool calls. The SignalWire platform runs the entire AI pipeline (STT, LLM, TTS), and your agent defines the behavior.

<!-- include: examples/quickstart-agent.ts#construct -->
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

In a clone of this repository, `swaig-test` checks an agent without running a server. These commands list the example agent's tools, print its SWML, and call its `get_time` tool:

```bash
npx tsx src/cli/swaig-test.ts examples/simple-agent.ts --list-tools
npx tsx src/cli/swaig-test.ts examples/simple-agent.ts --dump-swml
npx tsx src/cli/swaig-test.ts examples/simple-agent.ts --exec get_time
```

### Agent Features

An agent built on `AgentBase` gets these features:

- **Prompt Object Model (POM)**: structured prompt composition with `promptAddSection()`
- **SWAIG tools**: functions defined with `defineTool()` that the AI calls mid-conversation. A tool's result is context for the model, and its actions can control the call.
- **Skills system**: capabilities added in one line, such as `await agent.addSkill(new DateTimeSkill())`
- **Contexts and steps**: structured multi-step workflows with navigation control
- **DataMap tools**: tools that run on SignalWire's servers, calling REST APIs without your own webhook
- **Dynamic configuration**: a per-request copy of the agent, configured for each call, for multi-tenant deployments
- **Call flow control**: pre-answer, post-answer, and post-AI verb insertion
- **Prefab agents**: ready-to-use archetypes (InfoGatherer, Survey, FAQ, Receptionist, Concierge)
- **Multi-agent hosting**: multiple agents on a single server with `AgentServer`
- **SIP routing**: SIP calls routed to agents by username
- **Session state**: global data for the call, and post-prompt summaries when it ends
- **Security**: auto-generated basic auth, per-call tool tokens, webhook signature validation, and TLS support
- **Serverless**: automatic detection of Lambda, CGI, Google Cloud Functions, and Azure Functions

### Agent Examples

The [`examples/`](examples/) directory contains more than 50 working examples. These show the main features:

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

See [examples/README.md](examples/README.md) for the full list organized by category.

---

## RELAY Client

Real-time call control and messaging over WebSocket. The RELAY client connects to SignalWire via the Blade protocol and gives you imperative, async control over live phone calls and SMS/MMS.

The RELAY client connects with `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_API_TOKEN` and `SIGNALWIRE_SPACE` from the environment. This client answers each call on the `default` context, plays a greeting, and hangs up:

<!-- include: examples/quickstart-relay.ts#construct -->
```typescript
import { RelayClient, Call } from '@signalwire/sdk';

const client = new RelayClient({
  contexts: ['default'],
});

client.onCall(async (call: Call) => {
  await call.answer();
  const action = await call.play([{ type: 'tts', text: 'Welcome to SignalWire!' }]);
  await action.wait();
  await call.hangup();
});

client.run();
```

The RELAY client provides:

- Calling methods for play, record, collect, detect, tap, stream, AI, conferencing, and more
- SMS/MMS messaging with delivery tracking
- Action objects with `wait()`, `stop()`, `pause()`, `resume()`
- Auto-reconnect with exponential backoff

See the **[RELAY documentation](relay/README.md)** for the full guide, API reference, and examples.

---

## REST Client

Typed HTTP client for managing SignalWire resources and controlling calls over HTTP. It sends standard `fetch` requests, with no WebSocket.

This client creates a Fabric AI agent, plays text on a live call, searches for phone numbers and searches Datasphere documents:

<!-- include: examples/quickstart-rest.ts#construct -->
```typescript
import { RestClient } from '@signalwire/sdk';

const client = new RestClient({
  project: '...',
  token: '...',
  host: 'example.signalwire.com',
});

await client.fabric.aiAgents.create({ name: 'Support Bot', prompt: { text: 'You are helpful.' } });
await client.calling.play(callId, [{ type: 'tts', params: { text: 'Hello!' } }]);
await client.phoneNumbers.search({ areacode: '512' });
await client.datasphere.documents.search('billing policy');
```

The REST client provides:

- Namespaced API surfaces: Fabric, Calling, Video, Datasphere, Phone Numbers, SIP, Queues, Recordings, and more
- Node's built-in `fetch`, with no HTTP client dependency
- Plain object returns: the raw JSON, with no wrapper objects

See the **[REST documentation](rest/README.md)** for the full guide, API reference, and examples.

---

## Webhook Verification

Your Signing Key verifies that an inbound webhook (a status callback, a
messaging callback, or a SWML or SWAIG request) came from SignalWire.
`validateRequest` replaces the Compatibility API's `RestClient.validateRequest()`
and `validateRequestWithBody()`. It's a top-level export of `@signalwire/sdk`, so
you don't need the separate `@signalwire/compatibility-api` package.

This fragment checks a form-encoded webhook, then a JSON one:

<!-- snippet: no-run illustrative fragment: references the assumed `signingKey` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
import { validateRequest } from '@signalwire/sdk';

// Parsed form params, from a cXML (Compatibility API) webhook.
const ok = validateRequest(signingKey, signatureHeader, fullUrl, requestParams);

// The raw request body, for JSON and SWML webhooks, or a cXML body that
// carries bodySHA256.
const okBody = validateRequest(signingKey, signatureHeader, fullUrl, rawBodyString);
```

`validateRequest` folds both Compatibility API methods into one call: pass a
**parsed params object / `Map` / array of tuples** for form-encoded webhooks, or
the **raw body string** to additionally verify the `bodySHA256` the platform
includes for JSON/SWML payloads. It returns `true` on a match, `false`
otherwise, and throws if the Signing Key is missing.

`validateWebhookSignature(signingKey, signature, url, rawBody)` is the
lower-level check of one signature over a raw body.

SignalWire also sends an HMAC-SHA256 signature in the
`X-SignalWire-Sha256-Signature` header on JSON and SWML webhooks. It signs the
same message, the URL followed by the raw body, and you can check it with
`validateWebhookSignatureSha256(signingKey, signature, url, rawBody)`. An
agent's built-in validation, and `webhookValidationMiddleware`, check that
header first when it's present and fall back to `X-SignalWire-Signature`.

---

## Installation

One package covers agents, RELAY and REST. It requires Node.js 22 or later:

```bash
npm install @signalwire/sdk
```

## Documentation

The reference documentation is at **[developer.signalwire.com/sdks/agents-sdk](https://developer.signalwire.com/sdks/agents-sdk)**.

The [`docs/`](docs/) directory has these guides:

### Getting Started

- [Agent Guide](docs/agent-guide.md): creating agents, prompt configuration, dynamic setup
- [Architecture](docs/architecture.md): SDK architecture and core concepts
- [SDK Features](docs/sdk_features.md): feature overview, SDK vs raw SWML comparison

### Core Features

- [SWAIG Reference](docs/swaig-reference.md): function results, actions, post_data lifecycle
- [Contexts and Steps](docs/contexts-guide.md): structured workflows, navigation, gather mode
- [DataMap Guide](docs/datamap-guide.md): serverless API tools without webhooks
- [LLM Parameters](docs/llm_parameters.md): temperature, top_p, barge settings
- [SWML Service Guide](docs/swml_service_guide.md): low-level construction of SWML documents

### Skills and Extensions

- [Skills System](docs/skills-guide.md): built-in skills and the modular framework
- [Third-Party Skills](docs/third_party_skills.md): creating and publishing custom skills
- [MCP Gateway](docs/mcp_gateway_reference.md): Model Context Protocol integration
- [MCP Integration](docs/mcp_integration.md): MCP agent setup and configuration

### Deployment

- [CLI Guide](docs/cli-guide.md): `swaig-test` command reference
- [Cloud Functions](docs/cloud_functions_guide.md): Lambda, Cloud Functions, Azure deployment
- [Serverless Guide](docs/serverless-guide.md): deploy to AWS Lambda, Google Cloud Functions, Azure Functions, CGI
- [Configuration](docs/configuration.md): environment variables, SSL, proxy setup
- [Security](docs/security.md): authentication and security model

### Reference

- [API Reference](docs/api-reference.md): complete class and method reference
- [Web Service](docs/web_service.md): HTTP server and endpoint details
- [Skills Parameter Schema](docs/skills_parameter_schema.md): skill parameter definitions
- [Prefabs Guide](docs/prefabs-guide.md): pre-built agents: InfoGatherer, Survey, FAQ, Concierge, Receptionist

## Environment Variables

| Variable | Used by | Description |
|----------|---------|-------------|
| `SIGNALWIRE_PROJECT_ID` | RELAY, REST | Project identifier |
| `SIGNALWIRE_API_TOKEN` | RELAY, REST | API token |
| `SIGNALWIRE_SPACE` | RELAY, REST | Space hostname (e.g. `example.signalwire.com`) |
| `SIGNALWIRE_REST_BASE_URL` | REST | Override the REST base URL with a full `http(s)://` URL (local mock / private space / proxy). Precedence: `host` option > `SIGNALWIRE_REST_BASE_URL` > `SIGNALWIRE_SPACE`. |
| `SIGNALWIRE_REST_CA_FILE` | REST | Path to a PEM CA bundle to trust for HTTPS REST requests (private/self-signed certificates). |
| `SIGNALWIRE_RELAY_HOST` | RELAY | Override the RELAY WebSocket host (advanced/testing). Precedence: `host` option > `SIGNALWIRE_RELAY_HOST` > `SIGNALWIRE_SPACE` > built-in default. |
| `SIGNALWIRE_RELAY_SCHEME` | RELAY | Override the RELAY WebSocket scheme (`ws`/`wss`; default `wss`). Precedence: `scheme` option > `SIGNALWIRE_RELAY_SCHEME` > `wss`; any value other than `ws`/`wss` falls back to `wss`. |
| `SWML_BASIC_AUTH_USER` | Agents | Basic auth username (default: auto-generated) |
| `SWML_BASIC_AUTH_PASSWORD` | Agents | Basic auth password (default: auto-generated) |
| `SWML_PROXY_URL_BASE` | Agents | Base URL when behind a reverse proxy |
| `SWML_SSL_ENABLED` | Agents | Enable HTTPS (`true`, `1`, `yes`) |
| `SWML_SSL_CERT_PATH` | Agents | Path to SSL certificate |
| `SWML_SSL_KEY_PATH` | Agents | Path to SSL private key |
| `SIGNALWIRE_LOG_LEVEL` | All | Logging level (`debug`, `info`, `warn`, `error`) |
| `SIGNALWIRE_LOG_MODE` | All | Set to `off` to suppress all logging |

## Testing

The scripts under `scripts/` lint, format and test the SDK. They install their
dependencies on first run and work from any directory:

```bash
# Run the test suite (optional filter passed through to vitest)
bash scripts/run-tests.sh
bash scripts/run-tests.sh AgentBase

# Format the tree (or --check to verify without writing)
bash scripts/run-format.sh
bash scripts/run-format.sh --check

# Lint (tsc + eslint; --fix to autofix)
bash scripts/run-lint.sh
```

These npm scripts build the SDK and watch for changes:

```bash
# Build
npm run build

# Dev mode (watch + rebuild)
npm run dev

# Watch-mode tests
npm run test:watch
```

## License

MIT. See [LICENSE](LICENSE) for details.
