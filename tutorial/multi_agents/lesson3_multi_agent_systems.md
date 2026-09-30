# Lesson 3: Building Multi-Agent Systems

This lesson builds the complete PC Builder Pro system: three agents on one server. Alex answers every call and transfers the caller to Morgan in sales or Sam in support, with the caller's name and a summary of the conversation.

## Table of Contents

1. [How a multi-agent system fits together](#how-a-multi-agent-system-fits-together)
2. [The AgentServer class](#the-agentserver-class)
3. [Dynamic configuration](#dynamic-configuration)
4. [Agent-to-agent transfers](#agent-to-agent-transfers)
5. [Building the complete system](#building-the-complete-system)
6. [Testing multi-agent flows](#testing-multi-agent-flows)
7. [Production considerations](#production-considerations)
8. [Summary](#summary)

---

## How a multi-agent system fits together

Several specialized agents, each with a short prompt and a few tools, are easier to write and test than one agent that does everything. Each agent can change without touching the others, and a new specialist is one more route.

The caller always starts with the triage agent, which hands the call to one specialist:

```text
Caller --> Triage agent (Alex, /) --+--> Sales agent (Morgan, /sales)
                                    |
                                    +--> Support agent (Sam, /support)
```

The system has four parts:

1. **AgentServer**: serves all three agents on one port
2. **Routes**: each agent answers on its own path: `/`, `/sales` and `/support`
3. **Transfers**: the `swml_transfer` skill gives the triage agent a tool that moves the call to another agent's URL
4. **Context**: the caller's name and a summary travel with the call, in global data

## The AgentServer class

`AgentServer` hosts several agents in one process, each under its own route.

### Basic usage

This example creates a server, registers two agents on their routes, and runs it:

<!-- snippet: no-run starts an HTTP server on port 3001 -->
```typescript
import { AgentBase, AgentServer } from '@signalwire/sdk';

const triage = new AgentBase({ name: 'Triage', route: '/' });
triage.promptAddSection('AI Role', { body: 'You are Alex, the front desk assistant.' });

const sales = new AgentBase({ name: 'Sales', route: '/sales' });
sales.promptAddSection('AI Role', { body: 'You are Morgan, a sales specialist.' });

const server = new AgentServer({ host: '0.0.0.0', port: 3001, logLevel: 'info' });
server.register(triage, '/');
server.register(sales, '/sales');

await server.run();
```

`register()` takes the route as its second argument, or uses the agent's own route when you leave it out. It throws when two agents claim the same route.

### Server features

The server adds these to the agents' own routes:

- `/health` and `/ready`, which answer without credentials, for load balancers and container health checks
- The same security headers on every response
- A `GET /` listing of the agents, when no agent is registered at `/`
- HTTPS from the same `SWML_SSL_ENABLED`, `SWML_SSL_CERT_PATH` and `SWML_SSL_KEY_PATH` variables a single agent reads

Each agent keeps its own basic auth credentials. When `SWML_BASIC_AUTH_USER` and `SWML_BASIC_AUTH_PASSWORD` are set, every agent reads the same ones. Without them, each agent generates its own password. [Creating the server](#6-creating-the-server) shows why PC Builder Pro gives all three the same credentials.

The constructor's options are `host`, `port` and `logLevel`. `new AgentServer()` sets the SDK's global log level to `logLevel`, which is `info` unless you pass another.

## Dynamic configuration

A dynamic configuration callback changes an agent for one request. Requests for the SWML, for a SWAIG function and for the end-of-call summary all run it. The SDK copies the agent, calls the callback with the request and the copy, and serves the request from the copy. Changes to the copy never reach the next caller.

The callback receives four arguments:

- `query`: the request's query parameters
- `body`: the parsed request body
- `headers`: the request headers, with the credential-bearing ones removed
- `agent`: the per-request copy to configure

The callback can be `async`. `setDynamicConfigCallback()` sets the agent's callback, and replaces any set before. `addPerCallConfig()` adds one, and keeps the others.

PC Builder Pro uses callbacks for two jobs:

- The triage agent builds its transfer URLs from the URL the request reached it on, which depends on the proxy in front of it.
- The specialists check a `transfer=true` query parameter, and greet a transferred caller differently from a direct one.

### Building URLs with getFullUrl()

`agent.getFullUrl(true)` returns the agent's public URL with its basic auth credentials in it, ready to use as a transfer target. It finds the public address in this order:

1. `SWML_PROXY_URL_BASE`, when it's set
2. The `X-Forwarded-Host` and `Forwarded` headers of the request, when `SWML_TRUST_PROXY_HEADERS` is `true`
3. On a serverless platform such as AWS Lambda, the function URL its environment describes
4. The agent's host and port, with `https` and `SWML_SSL_DOMAIN` when the agent serves HTTPS

The triage agent is at `/`, so its URL is the server's. With `SWML_PROXY_URL_BASE=https://pcbuilder.example.com`, the support transfer goes here:

```text
https://devuser:devpassword@pcbuilder.example.com/support?transfer=true
```

## Agent-to-agent transfers

The `swml_transfer` skill gives an agent one tool. The model calls it with a destination, and the tool's result moves the call there. Each destination has a pattern to match and a `url` (another agent's SWML) or an `address` (a phone number or SIP address).

### How swml_transfer works

The PC Builder Pro configuration names the tool, its destination parameter, the fields the model must collect, and the two destinations:

- `tool_name`: `transfer_to_specialist`
- `parameter_name`: `specialist_type`, the argument that picks the destination
- `required_fields`: `user_name` and `summary`. The model must fill them in before it can call the tool.
- `transfers`: `/sales/i` and `/support/i`, regular expressions matched against `specialist_type`. The `i` makes them case-insensitive, so "Technical Support" matches `/support/i`.

When the model calls the tool, the skill tries each pattern in order. On a match, its result does three things:

1. It says the destination's `message` to the caller.
2. It saves the required fields in global data, under `call_data`.
3. It transfers the call to the destination's `url`, a SWML transfer. The `return_message` is what the triage agent says if the call comes back to it.

When nothing matches, the tool returns `default_message` and doesn't transfer. The skill also adds two sections to the triage agent's prompt, which list the destinations and the required fields.

### Accessing transfer data

The saved fields travel with the call. Every SWAIG request the receiving agent gets carries them in `global_data.call_data`, so its tool handlers can read `rawData.global_data?.call_data`. The sales and support prompts name them as `${call_data.user_name}` and `${call_data.summary}`, placeholders for SignalWire to fill in from global data when it runs the prompt. Check on a test call that the specialist greets the caller by name before you rely on the placeholders.

## Building the complete system

The complete system is `tutorial/multi_agents/pc_builder.ts`. Each agent comes from a function that creates and configures it, and a factory registers the three on one server.

### 1. Triage agent (Alex)

The triage agent has the energetic `rime.spore` voice, and adds its transfer tool per request:

<!-- snippet: no-compile a region of tutorial/multi_agents/pc_builder.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/pc_builder.ts#triage-agent -->
```typescript
/** Alex, the triage agent at the root route. */
export function createTriageAgent(options: AgentOptions): AgentBase {
  const agent = new AgentBase({ name: 'PC Builder Triage Agent', route: '/', ...options });

  configureTriagePrompt(agent);
  agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rime.spore' });

  // The transfer URLs depend on the request (proxy detection), so the
  // transfer tool is added to each request's copy of the agent
  agent.setDynamicConfigCallback(configureTransferTools);
  return agent;
}
```

`options` carries the server's host and port, and the credentials all three agents share. `configureTriagePrompt` adds Alex's prompt sections: the role, the triage tasks, the voice instructions, the rules and an example summary.

### 2. Dynamic transfer configuration

The callback builds each destination URL from the triage agent's own URL, then adds `swml_transfer` to the copy:

<!-- snippet: no-compile a region of tutorial/multi_agents/pc_builder.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/pc_builder.ts#transfer-tools -->
```typescript
/**
 * Runs for every request to the triage agent, on that request's copy of it,
 * and adds the swml_transfer skill with URLs built for this request.
 */
export async function configureTransferTools(
  _query: Record<string, string>,
  _body: unknown,
  _headers: Record<string, string>,
  agent: AgentBase,
): Promise<void> {
  // The triage agent's own URL, with its credentials, is the base for the others
  const base = agent.getFullUrl(true).replace(/\/+$/, '');
  const salesUrl = `${base}/sales?transfer=true`;
  const supportUrl = `${base}/support?transfer=true`;

  await agent.addSkill(
    new SwmlTransferSkill({
      tool_name: 'transfer_to_specialist',
      description: 'Transfer to sales or support specialist with conversation summary',
      parameter_name: 'specialist_type',
      parameter_description: 'The type of specialist to transfer to (sales or support)',
      required_fields: {
        user_name: "The customer's name",
        summary:
          'A comprehensive summary of the conversation so far, including what the customer needs help with',
      },
      transfers: {
        '/sales/i': {
          url: salesUrl,
          message: 'Perfect! Let me transfer you to our sales specialist right away.',
          return_message:
            'The call with the sales specialist is complete. How else can I help you?',
        },
        '/support/i': {
          url: supportUrl,
          message: "I'll connect you with our technical support specialist right away.",
          return_message:
            'The call with the support specialist is complete. How else can I help you?',
        },
      },
      default_message:
        'I can transfer you to either our sales or support specialist. Which would you prefer?',
    }),
  );
}
```

The tool is a SWAIG function that runs in the triage agent. The callback runs for the SWAIG request too, so the copy that handles the call to `transfer_to_specialist` has the tool.

### 3. Sales agent (Morgan)

The sales agent has Lesson 2's search tool, two sales tools, and a callback for its greeting:

<!-- snippet: no-compile a region of tutorial/multi_agents/pc_builder.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/pc_builder.ts#sales-agent -->
```typescript
/** Morgan, the sales specialist at /sales. */
export async function createSalesAgent(options: AgentOptions): Promise<AgentBase> {
  const agent = new AgentBase({ name: 'PC Builder Sales Specialist', route: '/sales', ...options });

  // Greet a transferred caller by name, and a direct caller normally
  agent.setDynamicConfigCallback(configureSalesGreeting);

  configureSalesPrompt(agent);
  agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rime.marsh' });

  await agent.addSkill(
    new NativeVectorSearchSkill({
      tool_name: 'search_sales_knowledge',
      description: 'Search sales and product information',
      documents: loadKnowledge(knowledgeFile('sales_knowledge.md')),
      count: 3,
    }),
  );

  agent.defineTool({
    name: 'create_build_recommendation',
    description: 'Create a custom PC build recommendation',
    parameters: {
      budget: { type: 'string', description: "The customer's budget in dollars" },
      use_case: { type: 'string', description: 'What the PC will be used for' },
      preferences: { type: 'string', description: 'Brand, size or style preferences' },
    },
    required: ['budget', 'use_case', 'preferences'],
    handler: ({ budget, use_case, preferences }) =>
      new FunctionResult(
        `Based on your $${budget} budget for ${use_case}, I recommend: ` +
          '[Custom build details would be generated here based on current ' +
          `market data and your preferences: ${preferences}]`,
      ),
  });

  agent.defineTool({
    name: 'check_component_compatibility',
    description: 'Check if PC components are compatible',
    parameters: {
      components: { type: 'string', description: 'The components to check, as a list' },
    },
    required: ['components'],
    handler: ({ components }) =>
      new FunctionResult(
        `Compatibility check for: ${components} - ` +
          '[Detailed compatibility analysis would be performed here]',
      ),
  });

  return agent;
}
```

The two sales tools return placeholder text. Lesson 4 covers writing tools that do real work. The support agent, `createSupportAgent`, has the same shape: the `rime.cove` voice, a search tool over `support_knowledge.md`, and the tools `diagnose_hardware_issue` and `create_support_ticket`.

### 4. Transfer detection

The sales agent's callback adds a greeting section that depends on how the caller arrived:

<!-- snippet: no-compile a region of tutorial/multi_agents/pc_builder.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/pc_builder.ts#sales-greeting -->
```typescript
/** Runs for every request to the sales agent, on that request's copy of it. */
export function configureSalesGreeting(
  query: Record<string, string>,
  _body: unknown,
  _headers: Record<string, string>,
  agent: AgentBase,
): void {
  if (query['transfer'] === 'true') {
    agent.promptAddSection('Call Transfer Information', {
      body: 'This call has been transferred to you from the triage agent.',
      bullets: [
        "The customer's name is ${call_data.user_name} - greet them by name",
        'They were transferred because: ${call_data.summary}',
        'Start by greeting them by name and acknowledging why they were transferred',
        "Example: 'Hi ${call_data.user_name}, I'm Morgan! I understand " +
          "you're looking to build a gaming PC with a $2000 budget. I'm " +
          "excited to help you build the perfect system!'",
      ],
    });
  } else {
    agent.promptAddSection('Initial Greeting', {
      body: 'This is a direct call to the sales department.',
      bullets: [
        'Greet the customer warmly and professionally',
        'Introduce yourself as a PC building sales specialist',
        'Ask for their name',
        'Ask how you can help them today',
        "Example: 'Hello! Welcome to PC Builder Pro sales. I'm Morgan, " +
          'your PC building specialist. May I have your name, and how can ' +
          "I help you build something amazing today?'",
      ],
    });
  }
}
```

The placeholders are in ordinary single-quoted strings, not template literals, so TypeScript leaves `${call_data.user_name}` as text for SignalWire.

### 5. The server factory

`createPcBuilderApp` creates the server and the three agents, and adds an `/info` route of the server's own:

<!-- snippet: no-compile a region of tutorial/multi_agents/pc_builder.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/pc_builder.ts#server -->
```typescript
/** Create the AgentServer with the three agents registered on their routes. */
export async function createPcBuilderApp(opts: PcBuilderOptions = {}): Promise<AgentServer> {
  const host = opts.host ?? '0.0.0.0';
  const port = opts.port ?? Number(process.env['PORT'] ?? 3001);
  // AgentServer sets the global log level, so pass SIGNALWIRE_LOG_LEVEL through
  const logLevel = opts.logLevel ?? process.env['SIGNALWIRE_LOG_LEVEL'] ?? 'info';
  const server = new AgentServer({ host, port, logLevel });

  // The triage agent puts its own credentials in the transfer URLs, so all
  // three agents must accept the same ones
  const agentOptions = { host, port, basicAuth: opts.basicAuth ?? sharedCredentials() };

  server.register(createTriageAgent(agentOptions), '/');
  server.register(await createSalesAgent(agentOptions), '/sales');
  server.register(await createSupportAgent(agentOptions), '/support');

  // A route of the server's own, beside the agents'
  server.getApp().get('/info', (c) => c.json(serviceInfo(host, port)));
  return server;
}
```

Each agent gets the server's host and port, because `getFullUrl()` builds URLs from the agent's own settings. `/info` is added last: the server rebuilds its app when an agent is registered, and a route added before that would be lost.

### 6. Creating the server

The transfer URL carries the triage agent's credentials, and the sales agent checks them. If each agent generated its own password, every transfer would fail with `401`. `sharedCredentials` makes sure the three agents agree:

<!-- snippet: no-compile a region of tutorial/multi_agents/pc_builder.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/pc_builder.ts#credentials -->
```typescript
/**
 * The credentials to give all three agents: undefined when
 * SWML_BASIC_AUTH_PASSWORD is set (each agent reads the same variables),
 * otherwise one generated password for all of them.
 */
function sharedCredentials(): [string, string] | undefined {
  if (process.env['SWML_BASIC_AUTH_PASSWORD']) return undefined;
  const user = process.env['SWML_BASIC_AUTH_USER'] || 'pc_builder';
  return [user, randomBytes(16).toString('hex')];
}
```

The end of the file creates the server when the module loads, and starts it only when you run the file:

<!-- snippet: no-compile a region of tutorial/multi_agents/pc_builder.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/pc_builder.ts#main -->
```typescript
export const server = await createPcBuilderApp();

// Start the server only when this file is run, not when it's imported
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = `http://localhost:${server.port}`;
  log.info('Starting PC Builder Pro Multi-Agent Service');
  log.info(`Triage Agent (Alex): ${url}/`);
  log.info(`Sales Agent (Morgan): ${url}/sales`);
  log.info(`Support Agent (Sam): ${url}/support`);
  log.info(`Service Info: ${url}/info`);
  await server.run();
}
```

Creating the agents at load time lets `swaig-test` find them, as [Testing transfers without a call](#testing-transfers-without-a-call) shows.

## Testing multi-agent flows

Test each agent over HTTP, then test the transfer without placing a call.

### Starting the system

Set the credentials, then run the file:

```bash
export SWML_BASIC_AUTH_USER=devuser
export SWML_BASIC_AUTH_PASSWORD=devpassword
npx tsx tutorial/multi_agents/pc_builder.ts
```

The log lists each agent and its route. This output is shortened, without the timestamps:

```text
[WARN] [AgentBase] [signalwire] webhook signature validation is disabled — set signingKey or SIGNALWIRE_SIGNING_KEY to enable
[INFO] [AgentServer] Registered 'PC Builder Triage Agent' at /
[INFO] [AgentServer] Registered 'PC Builder Sales Specialist' at /sales
[INFO] [AgentServer] Registered 'PC Builder Support Specialist' at /support
[INFO] [pc_builder] Starting PC Builder Pro Multi-Agent Service
[INFO] [pc_builder] Triage Agent (Alex): http://localhost:3001/
[INFO] [pc_builder] Sales Agent (Morgan): http://localhost:3001/sales
[INFO] [pc_builder] Support Agent (Sam): http://localhost:3001/support
[INFO] [pc_builder] Service Info: http://localhost:3001/info
[INFO] [AgentServer] Starting on http://0.0.0.0:3001
[INFO] [AgentServer]   / -> PC Builder Triage Agent (auth: devuser:****)
[INFO] [AgentServer]   /sales -> PC Builder Sales Specialist (auth: devuser:****)
[INFO] [AgentServer]   /support -> PC Builder Support Specialist (auth: devuser:****)
```

### Testing individual agents

Request each agent's SWML, and add the transfer flag to see the transferred-call prompt:

```bash
curl -u devuser:devpassword http://localhost:3001/
curl -u devuser:devpassword http://localhost:3001/sales
curl -u devuser:devpassword "http://localhost:3001/sales?transfer=true"
```

`jq` shows which prompt sections an agent serves. The transferred call gets `Call Transfer Information`:

```bash
curl -s -u devuser:devpassword "http://localhost:3001/sales?transfer=true" \
  | jq '.sections.main[1].ai.prompt.pom[].title'
```

The output lists the sales prompt, the search skill's section and the transfer section:

```text
"AI Role"
"Your Expertise"
"Your Tasks"
"Voice Instructions"
"Tools Available"
"Important"
"Knowledge Search"
"Call Transfer Information"
```

Without `?transfer=true`, the last section is `Initial Greeting`. `/health` and `/info` answer without credentials, and the agents' routes answer `401` without them.

### Testing transfers without a call

`swaig-test` loads the file, and `--route` picks the agent. Call the triage agent's transfer tool with the arguments the model would send:

```bash
npx tsx src/cli/swaig-test.ts tutorial/multi_agents/pc_builder.ts --route / \
  --exec transfer_to_specialist --specialist_type sales \
  --user_name 'Jane Doe' --summary 'Jane wants a gaming PC for about $1500.'
```

The result has the message, the `call_data` saved in global data, and the SWML that transfers the call to the sales agent:

```text
RESULT:
Response: Perfect! Let me transfer you to our sales specialist right away.

Actions:
{
  "set_global_data": {
    "call_data": {
      "user_name": "Jane Doe",
      "summary": "Jane wants a gaming PC for about $1500."
    }
  }
}
{
  "SWML": {
    "version": "1.0.0",
    "sections": {
      "main": [
        {
          "set": {
            "ai_response": "The call with the sales specialist is complete. How else can I help you?"
          }
        },
        {
          "transfer": {
            "dest": "http://devuser:devpassword@localhost:3001/sales?transfer=true"
          }
        }
      ]
    }
  },
  "transfer": "true"
}

Post-process: true
```

`Post-process: true` means the model speaks the message before SignalWire runs the actions. To see what happens next, request the `dest` URL with curl, as SignalWire does.

### Testing the transfer flow on a call

On a real call, a transfer moves through four stages:

1. **Call the triage agent**: Alex greets you.
2. **Give your name and describe what you need**: Alex asks until it has both.
3. **Ask for sales or support**: "I want to buy a gaming PC."
4. **Hear the handoff**: Alex says the transfer message, and Morgan answers.

### Monitoring transfers

The triage agent's log records each call to the transfer tool:

```text
[INFO] [AgentBase] function_executed_successfully endpoint=/swaig function=transfer_to_specialist call_id=...
```

Set `SIGNALWIRE_LOG_LEVEL=debug` for each request's details, including token checks.

## Production considerations

These settings matter once real callers reach the system.

### Security

Set the credentials, and the signing key that lets the agents verify a request came from SignalWire:

```bash
export SWML_BASIC_AUTH_USER=pcbuilder
export SWML_BASIC_AUTH_PASSWORD=a-long-random-password
export SIGNALWIRE_SIGNING_KEY=your-signing-key
```

Without the credentials, `pc_builder.ts` generates one password for the three agents and doesn't log it. The server serves HTTPS from the same variables Lesson 1 used:

```bash
SWML_SSL_ENABLED=true \
SWML_SSL_CERT_PATH=/path/to/cert.pem \
SWML_SSL_KEY_PATH=/path/to/key.pem \
SWML_SSL_DOMAIN=pcbuilder.example.com \
npx tsx tutorial/multi_agents/pc_builder.ts
```

The transfer URLs and webhook URLs contain the basic auth credentials, because SignalWire needs them to call back. Anyone who can read the SWML can read the password, so serve it over HTTPS. For more information, see the [security guide](../../docs/security.md).

### Deployment patterns

The same agents can be deployed three ways:

1. **One server**: all agents on one `AgentServer`, as in this lesson. One process to run and monitor, and one set of credentials.
2. **Separate servers**: each agent serves itself with `agent.run()`, and scales on its own. The transfer URLs then point at other hosts, so build them from configuration instead of from the triage agent's URL.
3. **Serverless**: an AWS Lambda function serves the whole system through `ServerlessAdapter`.

The file exports a Lambda handler for the third pattern:

<!-- snippet: no-compile a region of tutorial/multi_agents/pc_builder.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/pc_builder.ts#lambda -->
```typescript
/** AWS Lambda entry point: the same three agents, through ServerlessAdapter. */
export const lambdaHandler: (event: ServerlessEvent) => Promise<unknown> =
  ServerlessAdapter.createLambdaHandler(server.getApp());
```

On Lambda, set `SWML_BASIC_AUTH_PASSWORD`: a generated password changes with every cold start. For more information, see the [serverless guide](../../docs/serverless-guide.md).

### Monitoring

Point your load balancer or container health check at `/health`, which needs no credentials:

```bash
curl http://localhost:3001/health
```

It answers `{"status":"ok"}`. Set `SIGNALWIRE_LOG_LEVEL` to `debug` for more detail, or pass `logLevel` to `createPcBuilderApp`.

These are worth tracking in production:

- Transfers per destination, and transfers that end in the default message
- Response times of each agent's tools
- Errors by agent
- Calls where the specialist had to ask for the caller's name again

## Summary

This lesson built a complete multi-agent system. The main points:

- `AgentServer` hosts several agents on one port, each on its own route
- A dynamic configuration callback configures a per-request copy of an agent
- `getFullUrl(true)` builds proxy-aware URLs with the credentials in them
- `swml_transfer` transfers the call, and saves its required fields in global data as `call_data`
- A query parameter tells the receiving agent that the call was transferred
- Agents that transfer to each other must accept the same credentials

### Practice exercises

Try these before you move on:

1. **Add a fourth agent**: create a billing agent at `/billing`, and add a transfer pattern for it.
2. **Customize the transfer messages**: change what Alex says for each destination.
3. **Transfer to a person**: add a destination with an `address`, a phone number, instead of a `url`.
4. **Add a language**: give each agent a Spanish language entry.

### Troubleshooting

These problems come up most often in this lesson:

- **Transfers go to the wrong host**: set `SWML_PROXY_URL_BASE` to the URL SignalWire reaches the server on.
- **The specialist answers `401` after a transfer**: the agents have different credentials. Create them through `createPcBuilderApp`, or give them the same `basicAuth`.
- **The model doesn't transfer**: check that the prompt tells it to collect the name and summary, which the tool requires.
- **Port conflicts**: only one server can listen on a port. Set `PORT` to move this one.

### Next steps

Next, write tools that do real work, and deploy the system. Continue with [Lesson 4: Advanced Features and Best Practices](lesson4_advanced_features.md).

---

[Previous: Lesson 2 - Adding Intelligence with Knowledge Bases](lesson2_knowledge_bases.md) | [Tutorial Overview](README.md) | [Next: Lesson 4 - Advanced Features](lesson4_advanced_features.md)
