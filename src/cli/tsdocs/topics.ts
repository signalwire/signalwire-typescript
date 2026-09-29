/**
 * The hand-written part of sw-tsdocs: one entry per topic.
 *
 * Keep each body to what a reader needs to choose an approach and avoid
 * known mistakes, and point to the installed docs for the rest. Facts that
 * can be read from the installed package (the version, the commands, the
 * skills, the signatures) belong in the renderers, not here.
 * tests/cli/tsdocs.test.ts checks that every file, example, API name and
 * topic link given here exists, and that the `ts` snippets compile.
 */

/** A section a topic's page generates from the installed package. */
export type LiveSection = 'skills' | 'prefabs' | 'rest' | 'env' | 'cli';

/** One `sw-tsdocs <name>` page. */
export interface Topic {
  /** The word that prints it. */
  name: string;
  /** The page's heading. */
  title: string;
  /** One line for the index. */
  summary: string;
  /** Markdown: concepts and known mistakes. */
  body: string;
  /** Docs to read: a path under the package root and what it's for. */
  docs?: readonly (readonly [string, string])[];
  /** Examples: paths under the package root. A path ending in `/` means every example in it. */
  examples?: readonly string[];
  /** Names that `sw-tsdocs api` resolves. */
  api?: readonly string[];
  /** Other topics. */
  related?: readonly string[];
  /** A section generated from the installed package. */
  live?: LiveSection;
}

const QUICKSTART: Topic = {
  name: 'quickstart',
  title: 'Quickstart: a working agent in one file',
  summary: 'The smallest complete agent, and how to run and test it',
  body: `\`\`\`ts
import { AgentBase, FunctionResult } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'my-agent', route: '/agent' });
agent.addLanguage({ name: 'English', code: 'en-US', voice: 'inworld.Mark' });
agent.promptAddSection('Role', { body: 'You are a helpful assistant.' });

agent.defineTool({
  name: 'get_time',
  description: 'Get the current time',
  parameters: {},
  handler: () => new FunctionResult(\`The time is \${new Date().toLocaleTimeString()}.\`),
});

await agent.run();
\`\`\`

- Run it with \`npx tsx my-agent.ts\`. \`run()\` starts a web server on port
  3000 (or \`PORT\`). It serves the agent's SWML document at \`/agent\` and its
  tools at \`/agent/swaig\`. On AWS Lambda, Google Cloud Functions, Azure
  Functions or CGI, it handles the platform's request instead.
- Every endpoint except the \`/health\` and \`/ready\` probes needs basic auth.
  Set \`SWML_BASIC_AUTH_USER\` and \`SWML_BASIC_AUTH_PASSWORD\`; otherwise the
  agent generates a password, which \`agent.getBasicAuthCredentials()\`
  returns.
- To take calls, SignalWire must reach the agent over HTTPS: deploy it, or use
  a tunnel during development and set \`SWML_PROXY_URL_BASE\` to the public URL.
  Then point a phone number's SWML webhook at
  \`https://USER:PASSWORD@HOST/agent\`, in the dashboard or with the REST client
  (\`rest/examples/rest-bind-phone-to-swml-webhook.ts\`).

Test it without a call:

\`\`\`bash
npx swaig-test my-agent.ts --list-tools
npx swaig-test my-agent.ts --dump-swml
npx swaig-test my-agent.ts --exec get_time
\`\`\`
`,
  docs: [
    ['README.md', "The SDK's overview and quickstarts for agents, RELAY and REST"],
    ['docs/agent-guide.md', 'The main guide to building agents'],
  ],
  examples: [
    'examples/quickstart-agent.ts',
    'examples/quickstart-relay.ts',
    'examples/quickstart-rest.ts',
  ],
  api: ['AgentBase', 'FunctionResult', 'AgentBase.run'],
  related: ['agents', 'tools', 'testing', 'deploy'],
};

const AGENTS: Topic = {
  name: 'agents',
  title: 'AI agents (AgentBase)',
  summary: "Voice and text AI agents: how they work and how they're built",
  body: `An agent is a web service, and SignalWire runs the conversation. When a call
arrives, SignalWire fetches the agent's SWML document (prompt, voice,
languages, tools, settings) and runs speech recognition, the LLM and
text-to-speech itself. When the model calls a tool, SignalWire posts the call
to the agent's \`/swaig\` endpoint, and your handler returns a
\`FunctionResult\`. Your code never handles audio.

Build one by constructing \`AgentBase\` and configuring it, or by subclassing it
(\`static PROMPT_SECTIONS\` for the prompt, and an overridden \`defineTools()\`,
which the SDK calls once, the first time the tools are needed):

- Voice and language: \`addLanguage()\`. Prompt: \`promptAddSection()\` or
  \`setPromptText()\` (\`sw-tsdocs prompts\`).
- Tools: \`defineTool()\`, or DataMap tools that run on SignalWire
  (\`sw-tsdocs tools\`, \`sw-tsdocs datamap\`).
- Ready-made tools: \`addSkill()\` and \`addSkillByName()\` (\`sw-tsdocs skills\`).
- Multi-step workflows: \`defineContexts()\` (\`sw-tsdocs contexts\`).
- An end-of-call summary: \`setPostPrompt()\`, received by \`onSummary()\`.

Serving: \`run()\` or \`serve()\` for one agent, \`AgentServer\` for several agents
in one process, and \`getApp()\` (a Hono app) or \`asRouter()\` to mount an agent
in an existing web app.

Per-call configuration: \`setDynamicConfigCallback()\` configures a copy of the
agent for each request, from its query parameters, body and headers, for
per-tenant prompts, voices and tools. Handlers for different calls interleave
at every \`await\`: don't keep per-caller state on the shared agent instance.
`,
  docs: [
    ['docs/agent-guide.md', 'The main guide: prompts, tools, skills, contexts, serving'],
    ['docs/architecture.md', 'How the pieces fit: the managers AgentBase composes, request flow'],
    ['docs/api-reference.md', 'Reference for AgentBase and the other public classes'],
    ['docs/sdk_features.md', 'What the SDK adds over writing SWML by hand'],
    ['docs/configuration.md', 'Config files and environment variables'],
    ['docs/pgi_agent_guide.md', 'How to design agents that stay within their rules'],
  ],
  examples: [
    'examples/simple-agent.ts',
    'examples/simple-static.ts',
    'examples/declarative.ts',
    'examples/dynamic-config.ts',
    'examples/comprehensive-dynamic.ts',
    'examples/multi-agent.ts',
    'examples/custom-path.ts',
    'examples/multi-endpoint.ts',
  ],
  api: [
    'AgentBase',
    'AgentOptions',
    'AgentServer',
    'AgentBase.setDynamicConfigCallback',
    'AgentBase.getApp',
    'AgentBase.onSummary',
  ],
  related: ['prompts', 'tools', 'contexts', 'skills', 'pgi', 'deploy'],
};

const PROMPTS: Topic = {
  name: 'prompts',
  title: 'Prompts, voice and model settings',
  summary: 'Prompt sections, post-prompt summaries, languages, voices and LLM parameters',
  body: `- The Prompt Object Model builds the prompt from titled sections:
  \`promptAddSection(title, { body, bullets })\`, \`promptAddSubsection()\` and
  \`promptAddToSection()\`. \`setPromptText()\` sets a plain prompt instead. A
  subclass's \`static PROMPT_SECTIONS\` declares the sections on the class.
- \`setPostPrompt(text)\` asks the model for a summary when the conversation
  ends. \`onSummary(summary, rawData)\` receives it.
- \`addLanguage({ name, code, voice })\` sets the language and voice.
  \`addHints()\` and \`addPronunciation()\` help speech recognition and
  text-to-speech with your vocabulary.
- \`setParams()\` sets the platform's AI settings. \`setPromptLlmParams()\` and
  \`setPostPromptLlmParams()\` set model parameters such as \`temperature\` and
  \`top_p\`. Nothing is sent unless you set it.
- \`setGlobalData()\` and \`updateGlobalData()\` hold session data for the call.
  It isn't a database, and the model doesn't see all of it: tools, templates
  and prompts expose what they choose.

Keep prompts short and put rules that matter in code: a prompt asks, a tool
handler enforces (\`sw-tsdocs pgi\`).
`,
  docs: [
    ['docs/agent-guide.md', 'Prompt building, languages and voices, global data'],
    ['docs/llm_parameters.md', 'Model parameters for the prompt and post-prompt'],
  ],
  examples: [
    'examples/declarative.ts',
    'examples/pom-prompt.ts',
    'examples/llm-params.ts',
    'examples/session-state.ts',
  ],
  api: [
    'AgentBase.promptAddSection',
    'AgentBase.setPromptText',
    'AgentBase.setPostPrompt',
    'AgentBase.addLanguage',
    'AgentBase.setParams',
    'AgentBase.setPromptLlmParams',
    'AgentBase.setGlobalData',
  ],
  related: ['agents', 'tools', 'pgi'],
};

const TOOLS: Topic = {
  name: 'tools',
  title: 'Tools (SWAIG functions) and FunctionResult',
  summary: 'Functions the model can call, and what they return',
  body: `A tool is a function the model can ask to call. SignalWire posts the call to
the agent's \`/swaig\` endpoint, and the SDK runs your handler. Handlers may be
\`async\`; while one awaits, handlers for other calls run, so guard state they
share.

Give the parameters as a flat map and list the required ones; the handler's
\`args\` are typed from them, so don't annotate or cast \`args\`:

\`\`\`ts
import { AgentBase, FunctionResult } from '@signalwire/sdk';

const orders = new Map<string, { shippedOn: string }>();
const agent = new AgentBase({ name: 'orders', route: '/orders' });

agent.defineTool({
  name: 'get_order_status',
  description: "Look up an order's status.",
  parameters: {
    order_id: { type: 'string', description: 'The order number the caller gives' },
  },
  required: ['order_id'],
  handler: (args) => {
    const order = orders.get(args.order_id); // your code decides what's true
    if (!order) return new FunctionResult('No order has that number.');
    return new FunctionResult({
      tool_result: \`Order \${args.order_id} shipped \${order.shippedOn}.\`,
      tool_prompt: 'Tell the caller when the order shipped.',
    });
  },
});
\`\`\`

- The description and parameter descriptions are prompt text: the model reads
  them to decide when to call the tool.
- \`FunctionResult\`'s response is context for the model, not speech. Keep facts
  (\`tool_result\`) apart from instructions (\`tool_prompt\`).
- Actions such as \`connect()\`, \`hangup()\`, \`hold()\`, \`sendSms()\`,
  \`updateGlobalData()\` and \`swmlChangeStep()\` run on the platform. Call
  \`setPostProcess(true)\` when the caller must hear something before one lands.
- The handler's second argument, \`rawData\`, is the whole request (typed
  \`SwaigRequest\`), with \`call_id\` and \`global_data\`.
- Tools are secure by default: each call must carry a token minted into that
  call's SWML.
- A tool call is a request from the model, not an authorization. Check
  identity, state and business rules in the handler.
`,
  docs: [
    ['docs/swaig-reference.md', 'Every FunctionResult method and action'],
    ['docs/agent-guide.md', 'Defining tools, typed parameters, secure tools'],
    ['docs/pgi_agent_guide.md', 'What a tool may decide, and what code must enforce'],
  ],
  examples: [
    'examples/swaig-features.ts',
    'examples/typed-tools.ts',
    'examples/call-flow.ts',
    'examples/session-state.ts',
    'examples/record-call.ts',
    'examples/room-and-sip.ts',
    'examples/tap.ts',
  ],
  api: [
    'AgentBase.defineTool',
    'FunctionResult',
    'FunctionResult.connect',
    'FunctionResult.swmlChangeStep',
    'FunctionResult.setPostProcess',
    'SwaigRequest',
  ],
  related: ['datamap', 'contexts', 'skills', 'security', 'pgi'],
};

const DATAMAP: Topic = {
  name: 'datamap',
  title: 'DataMap: tools that run on SignalWire',
  summary: "Tools that call an HTTP API from SignalWire's servers, with no webhook to your code",
  body: `A DataMap tool calls an HTTP API from SignalWire's servers, or matches
patterns in its arguments, and fills the result into the model's context from
a template. Your server isn't involved when the tool runs.

\`\`\`ts
import { AgentBase, DataMap, FunctionResult } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'weather', route: '/weather' });
const weather = new DataMap('get_weather')
  .description('Get the current weather for a city')
  .parameter('city', 'string', 'City name', { required: true })
  .webhook('GET', 'https://api.example.com/weather?city=\${enc:args.city}')
  .output(new FunctionResult('Weather in \${input.args.city}: \${current.summary}'));
agent.registerSwaigFunction(weather.toSwaigFunction());
\`\`\`

- The templates are plain strings, not template literals: the platform
  expands them, not the SDK.
- A webhook's URL and params read the call's data: \`\${args.city}\` for an
  argument. A webhook's output reads its JSON response from the root, so an
  API that returns \`{"current": {...}}\` is read as \`\${current.summary}\`,
  with no \`response.\` prefix; an array response is \`\${array[0].x}\`; and
  the arguments there are \`\${input.args.city}\`.
- The prefix helpers \`lc:\`, \`enc:\` and \`fmt_ph:\` transform a value. The
  platform applies fmt_ph, then lc, then enc, whatever order they are written
  in: \`\${lc:enc:args.city}\` lowercases \`args.city\`, then URL-encodes it.
  \`enc\` takes no encoding name: \`\${enc:url:args.city}\` reads the path
  \`url:args.city\` and expands to nothing.
- A webhook's \`params()\` are its JSON request body.
- \`swaig-test --exec\` simulates a DataMap tool locally, including its HTTP
  request.
- Use DataMap for simple lookups. Use a \`defineTool()\` handler when the result
  depends on your own logic, authorization or state.
`,
  docs: [['docs/datamap-guide.md', 'The DataMap builder, templates, expressions and testing']],
  examples: ['examples/datamap-tools.ts', 'examples/advanced-datamap.ts', 'examples/joke-agent.ts'],
  api: [
    'DataMap',
    'AgentBase.registerSwaigFunction',
    'createSimpleApiTool',
    'createExpressionTool',
  ],
  related: ['tools', 'testing'],
};

const CONTEXTS: Topic = {
  name: 'contexts',
  title: 'Contexts and steps',
  summary: 'Multi-step workflows, per-step tools, and gathering answers',
  body: `\`defineContexts()\` returns a \`ContextBuilder\`. Each context holds steps, and
each step has its own prompt text, its own tools and its own exits:

\`\`\`ts
import { AgentBase } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'accounts', route: '/accounts' });
const ctx = agent.defineContexts().addContext('default'); // a single context must be named "default"
ctx
  .addStep('identify')
  .setText("Ask for the caller's account number.")
  .setFunctions(['verify_account'])
  .setValidSteps([]);
ctx
  .addStep('help')
  .setText('Help with the account.')
  .setFunctions(['get_balance', 'transfer_to_agent']);
\`\`\`

- Call \`setFunctions()\` on every step. A step that doesn't set it can keep the
  previous step's tools; \`setFunctions([])\` gives it none.
- \`setValidSteps()\` and \`setValidContexts()\` limit where the model may move.
  To move only after your code has checked something, leave them empty and
  return \`new FunctionResult().swmlChangeStep(...)\` from the handler.
- \`setStepCriteria()\` guides the model; it doesn't enforce anything.
- \`setGatherInfo()\` and \`addGatherQuestion()\` collect answers one question
  at a time.
`,
  docs: [
    ['docs/contexts-guide.md', 'Contexts, steps, navigation, gather mode and history'],
    ['docs/pgi_agent_guide.md', 'Scoping tools per step and code-owned transitions'],
  ],
  examples: [
    'examples/contexts-steps.ts',
    'examples/gather-info.ts',
    'examples/gather-per-question-functions-demo.ts',
    'examples/step-function-inheritance-demo.ts',
  ],
  api: [
    'AgentBase.defineContexts',
    'ContextBuilder',
    'Context',
    'Step',
    'Step.setFunctions',
    'Step.setGatherInfo',
    'FunctionResult.swmlChangeStep',
  ],
  related: ['tools', 'pgi', 'prompts'],
};

const SKILLS: Topic = {
  name: 'skills',
  title: 'Skills: ready-made capabilities',
  summary: 'Built-in skills (web search, datetime, DataSphere, ...) and writing your own',
  body: `A skill adds tools, prompt sections and hints to an agent in one call:

\`\`\`ts
import { AgentBase, DateTimeSkill } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'helper', route: '/helper' });
await agent.addSkill(new DateTimeSkill());
await agent.addSkillByName('web_search', { api_key: '...', search_engine_id: '...' });
\`\`\`

- \`addSkill()\` and \`addSkillByName()\` return promises: await them before the
  agent serves.
- A skill that allows several instances takes a \`tool_name\` parameter, so each
  instance gets its own tool.
- \`sw-tsdocs skills <name>\` shows a skill's parameters.
- Write your own by subclassing \`SkillBase\`: set the static \`SKILL_NAME\` and
  \`SKILL_DESCRIPTION\`, and return the tools from \`getTools()\` (built with
  \`defineSkillTool()\`); \`setup()\`, \`getPromptSections()\` and \`getHints()\`
  are optional. \`registerSkill()\` registers the class, and
  \`addSkillDirectory()\` or \`SIGNALWIRE_SKILL_PATHS\` load skills from a
  directory.
`,
  docs: [
    ['docs/skills-guide.md', 'Using the built-in skills'],
    ['docs/skills-system.md', 'How skills load, and how to write one'],
    ['docs/skills_parameter_schema.md', 'How skills describe their parameters'],
    ['docs/third_party_skills.md', 'Packaging and loading skills from outside the SDK'],
  ],
  examples: [
    'examples/skills-demo.ts',
    'examples/wikipedia.ts',
    'examples/web-search.ts',
    'examples/web-search-multi-instance.ts',
    'examples/datasphere.ts',
    'examples/datasphere-multi-instance.ts',
  ],
  api: [
    'AgentBase.addSkill',
    'AgentBase.addSkillByName',
    'SkillBase',
    'defineSkillTool',
    'registerSkill',
    'addSkillDirectory',
  ],
  related: ['agents', 'mcp', 'datamap'],
  live: 'skills',
};

const PREFABS: Topic = {
  name: 'prefabs',
  title: 'Prefab agents',
  summary: 'Ready-made agents for surveys, intake, reception, FAQs and concierge',
  body: `Prefabs are \`AgentBase\` subclasses for common jobs. Configure one with its
constructor options, or subclass it to change its prompt and tools.
`,
  docs: [['docs/prefabs-guide.md', 'Each prefab and its options']],
  examples: [
    'examples/prefab-info-gatherer.ts',
    'examples/dynamic-info-gatherer.ts',
    'examples/prefab-survey.ts',
    'examples/prefab-receptionist.ts',
    'examples/prefab-concierge.ts',
    'examples/prefab-faq.ts',
  ],
  api: ['InfoGathererAgent', 'SurveyAgent', 'ReceptionistAgent', 'ConciergeAgent', 'FAQBotAgent'],
  related: ['agents'],
  live: 'prefabs',
};

const SWML: Topic = {
  name: 'swml',
  title: 'SWML services: call flows without an AI agent',
  summary: 'Build and serve SWML documents: IVRs, routing, recording, any verb',
  body: `SWML is the JSON document that tells SignalWire what to do with a call.
\`AgentBase\` writes one with an \`ai\` verb. \`SWMLService\` builds any document,
from any verbs, and serves it the same way:

\`\`\`ts
import { SWMLService } from '@signalwire/sdk';

const service = new SWMLService({ name: 'greeter', route: '/greeter' });
service.addVerb('answer', {});
service.addVerb('play', { url: 'say:Thanks for calling.' });
service.addVerb('hangup', {});
await service.serve();
\`\`\`

- Verbs are validated against the SWML schema that ships with the package
  (\`dist/schema.json\`). \`SwmlBuilder\` also has a typed method for each verb,
  such as \`play()\` and \`hangup()\`.
- \`setOnRequestCallback()\` builds the document per request.
- An \`AgentBase\` adds verbs around its \`ai\` verb: \`addPreAnswerVerb()\`,
  \`addPostAnswerVerb()\` and \`addPostAiVerb()\`.
`,
  docs: [
    ['docs/swml_service_guide.md', 'SWMLService and SwmlBuilder'],
    ['docs/architecture.md', 'How SWML documents are built and served'],
  ],
  examples: [
    'examples/swml-service.ts',
    'examples/dynamic-swml-service.ts',
    'examples/swml-service-routing.ts',
    'examples/auto-vivified.ts',
    'examples/verb-methods.ts',
    'examples/swmlservice_swaig_standalone.ts',
    'examples/swmlservice_ai_sidecar.ts',
  ],
  api: ['SWMLService', 'SwmlBuilder', 'SWMLService.addVerb', 'SWMLService.setOnRequestCallback'],
  related: ['agents', 'relay', 'rest'],
};

const RELAY: Topic = {
  name: 'relay',
  title: 'RELAY: real-time call and message control',
  summary: 'Drive live calls and messages over WebSocket with async code',
  body: `\`RelayClient\` holds a WebSocket connection to SignalWire. Your code answers
and places calls, and then drives them step by step: play, record, collect
digits, detect, connect, conference, transcribe, and send or receive messages.

\`\`\`ts
import { RelayClient, Call } from '@signalwire/sdk';

const client = new RelayClient({ contexts: ['default'] }); // credentials from the environment

client.onCall(async (call: Call) => {
  await call.answer();
  const action = await call.play([{ type: 'tts', text: 'Welcome!' }]);
  await action.wait();
  await call.hangup();
});

await client.run();
\`\`\`

- Credentials come from the options or from \`SIGNALWIRE_PROJECT_ID\`,
  \`SIGNALWIRE_API_TOKEN\` and \`SIGNALWIRE_SPACE\`.
- Operations that take time return an action: \`await action.wait()\` for its
  result.
- Choose RELAY when your code controls the call, an AI agent when the model
  holds the conversation, and REST for managing resources over HTTP.
`,
  docs: [
    ['relay/README.md', 'Overview of the RELAY client'],
    ['relay/docs/getting-started.md', 'Connecting, receiving calls, first steps'],
    ['relay/docs/guide.md', 'The RELAY guide: calls, actions, events and messaging'],
    ['relay/docs/client-reference.md', 'RelayClient reference'],
    ['relay/docs/call-methods.md', 'Every Call method'],
    ['relay/docs/events.md', 'Events and their payloads'],
    ['relay/docs/messaging.md', 'Sending and receiving messages'],
  ],
  examples: [
    'examples/quickstart-relay.ts',
    'examples/relay-demo.ts',
    'relay/examples/relay-inbound.ts',
    'relay/examples/relay-outbound.ts',
    'relay/examples/relay-messaging.ts',
  ],
  api: ['RelayClient', 'Call', 'Message', 'RelayClient.onCall', 'Call.play'],
  related: ['rest', 'swml', 'agents'],
};

const REST: Topic = {
  name: 'rest',
  title: 'REST client',
  summary: 'Manage SignalWire resources over HTTP: numbers, Fabric, calls, video, messaging',
  body: `\`RestClient\` is an HTTP client with one namespace per API area. Each method
returns a promise of the response's JSON:

\`\`\`ts
import { RestClient } from '@signalwire/sdk';

const client = new RestClient(); // SIGNALWIRE_PROJECT_ID, SIGNALWIRE_API_TOKEN, SIGNALWIRE_SPACE
await client.phoneNumbers.search({ areacode: '512' });
await client.fabric.aiAgents.create({ name: 'Support Bot', prompt: { text: 'You are helpful.' } });
\`\`\`

- \`client.calling\` sends commands to live calls, such as play and record.
- Errors throw \`RestError\` (\`SignalWireRestError\`), with the status code and
  body.
`,
  docs: [
    ['rest/README.md', 'Overview of the REST client'],
    ['rest/docs/getting-started.md', 'Credentials and first requests'],
    ['rest/docs/guide.md', 'The REST guide: namespaces, pagination and errors'],
    ['rest/docs/client-reference.md', 'RestClient reference'],
    ['rest/docs/namespaces.md', 'Every namespace and its operations'],
    ['rest/docs/calling.md', 'Commands for live calls'],
    ['rest/docs/fabric.md', 'Fabric resources: AI agents, subscribers, SWML scripts'],
    ['rest/docs/phone-binding.md', 'Pointing a phone number at an agent or a SWML script'],
  ],
  examples: [
    'examples/quickstart-rest.ts',
    'rest/examples/rest-client.ts',
    'rest/examples/rest-manage-resources.ts',
    'rest/examples/rest-bind-phone-to-swml-webhook.ts',
    'rest/examples/rest-phone-number-management.ts',
    'rest/examples/rest-calling-play-and-record.ts',
    'rest/examples/rest-calling-ivr-and-ai.ts',
    'rest/examples/rest-fabric-swml-and-callflows.ts',
    'rest/examples/rest-fabric-subscribers-and-sip.ts',
    'rest/examples/rest-fabric-conferences-and-routing.ts',
    'rest/examples/rest-video-rooms.ts',
    'rest/examples/rest-queues-mfa-and-recordings.ts',
    'rest/examples/rest-datasphere-search.ts',
    'rest/examples/rest-10dlc-registration.ts',
  ],
  api: ['RestClient', 'RestError', 'ClientOptions'],
  related: ['relay', 'swml', 'deploy'],
  live: 'rest',
};

const LIVEWIRE: Topic = {
  name: 'livewire',
  title: 'LiveWire: LiveKit Agents code on SignalWire',
  summary: 'Run agents written against the LiveKit Agents API on SignalWire',
  body: `\`@signalwire/sdk/livewire\` (also the \`livewire\` export of the package root)
offers the LiveKit Agents API (\`Agent\`, \`AgentSession\`, \`tool\`, \`defineAgent\`,
\`runApp\` and friends), so LiveKit agent code can run on SignalWire with a
changed import. SignalWire's platform runs speech recognition, the LLM and
text-to-speech, so the speech plugin options are accepted for compatibility
and ignored, and an LLM plugin's model name sets the model.
`,
  docs: [
    ['livewire/README.md', 'What LiveWire supports'],
    ['livewire/docs/migration-guide.md', 'Moving a LiveKit agent to LiveWire'],
  ],
  examples: [
    'livewire/examples/livewire-basic-agent.ts',
    'livewire/examples/livewire-multi-tool.ts',
    'livewire/examples/livewire-handoff.ts',
  ],
  api: ['livewire', 'livewire.Agent', 'livewire.AgentSession', 'livewire.tool', 'livewire.runApp'],
  related: ['agents'],
};

const MCP: Topic = {
  name: 'mcp',
  title: 'MCP: Model Context Protocol',
  summary: 'Expose agent tools over MCP, call MCP servers from agents, and the MCP gateway',
  body: `- An agent as an MCP server: \`enableMcpServer()\` adds an \`/mcp\` endpoint
  that offers the agent's tools to MCP clients. It requires the agent's basic
  auth credentials.
- MCP servers as an agent's tools: \`addMcpServer(url, { headers })\` lets the
  platform discover and call a remote MCP server's tools during the call.
- MCP servers that run locally: the \`mcp_gateway\` skill connects an agent to
  an MCP gateway service, which bridges them to SWAIG tools.
`,
  docs: [
    ['docs/mcp_integration.md', 'The /mcp endpoint and addMcpServer()'],
    ['docs/mcp_gateway_reference.md', 'The MCP gateway service and skill'],
  ],
  examples: ['examples/mcp-agent.ts', 'examples/mcp-gateway.ts'],
  api: ['AgentBase.enableMcpServer', 'AgentBase.addMcpServer', 'McpGatewaySkill'],
  related: ['tools', 'skills'],
};

const CHAT: Topic = {
  name: 'chat',
  title: 'AI chat: client, gateway and voice handoff',
  summary: 'Text chat with an agent: AIChatClient, ChatGateway for browsers, HandoffRouter',
  body: `The AI Chat service runs an agent's conversation over text instead of a call.

- \`AIChatClient\` calls the service from your server with the project's
  credentials: \`createConversation()\`, \`chat()\` (a full model turn, so it
  takes seconds), \`log()\`, \`summarize()\` and \`end()\`.
- \`ChatGateway\` lets a web page chat without the project token, which would
  let every visitor spend the project's money. Mount \`gateway.router()\` on your
  app (\`agent.mount(gateway.router(), { prefix: '/chat' })\`); the browser holds
  only a publishable key. Keep \`maxNewConversations\` and \`maxTurns\` set:
  they're the control on a leaked key, and \`allowedOrigins\` only contains
  one.
- \`HandoffRouter\` adds the routes that move a conversation between chat and a
  phone call and let the page type into a live call. The browser presents a
  one-time nonce, never a call id.
- The gateway's caps and the router's nonces live in the process: run one
  replica, use sticky routing, or supply shared storage.
- What the browser sends (\`user_meta_data\`) is the visitor's claim, never
  authority.
`,
  docs: [
    ['docs/ai_chat.md', 'The chat client, the gateway and the voice handoff'],
    ['docs/security.md', 'Credentials and what each protection covers'],
  ],
  api: ['AIChatClient', 'AIChatClient.chat', 'ChatGateway', 'ChatGatewayOptions', 'HandoffRouter'],
  related: ['agents', 'security'],
};

const BEDROCK: Topic = {
  name: 'bedrock',
  title: 'Amazon Bedrock agents',
  summary: "Agents that use Amazon Bedrock's speech-to-speech model",
  body: `\`BedrockAgent\` is an \`AgentBase\` that renders an \`amazon_bedrock\` verb
instead of the standard \`ai\` verb. Prompts, tools and skills work the same
way. Speech hints, languages, pronunciation rules, multilingual settings and
contexts aren't part of the Bedrock verb, so they're left out of the SWML with
a warning. \`setInferenceParams()\` sets \`temperature\`, \`top_p\` and
\`max_tokens\`, which must be numbers, and \`setVoice()\` takes one of the
voices Bedrock offers.
\`createBedrockAgent()\` is a factory for the same class.
`,
  docs: [['docs/bedrock_agent.md', "BedrockAgent's options and differences"]],
  api: [
    'BedrockAgent',
    'BedrockAgentConfig',
    'BedrockAgent.setInferenceParams',
    'createBedrockAgent',
  ],
  related: ['agents'],
};

const DEPLOY: Topic = {
  name: 'deploy',
  title: 'Deploying agents',
  summary: 'Servers, serverless platforms, containers, public URLs and TLS',
  body: `- \`run()\` works out where it's running. As a plain process or in a container,
  it starts a web server. On AWS Lambda, Google Cloud Functions, Azure
  Functions or CGI, it handles the platform's event; \`runServerless()\` handles
  one explicitly.
- SignalWire calls back to the URLs in the agent's SWML. Behind a proxy, load
  balancer or tunnel, set \`SWML_PROXY_URL_BASE\` to the public base URL.
- Serve TLS directly with \`SWML_SSL_ENABLED\`, \`SWML_SSL_CERT_PATH\` and
  \`SWML_SSL_KEY_PATH\`, or terminate it in front of the agent.
- Run several agents in one process with \`AgentServer\`, or mount one in an
  existing app with \`getApp()\` or \`asRouter()\`.
- With more than one replica, set \`SIGNALWIRE_SWAIG_SECRET\` to the same value
  on each, so a tool token minted by one validates on another.
- The SDK needs Node.js 22 or later.
`,
  docs: [
    ['docs/serverless-guide.md', 'Serverless platforms: detection, handlers and URLs'],
    ['docs/cloud_functions_guide.md', 'Lambda, Google Cloud Functions and Azure Functions'],
    ['docs/configuration.md', 'Config files and environment variables'],
    ['docs/security.md', 'Auth, signatures, tokens and TLS in production'],
    ['docs/web_service.md', 'Serving static files alongside agents'],
  ],
  examples: [
    'examples/serverless-lambda.ts',
    'examples/kubernetes-agent.ts',
    'examples/multi-agent.ts',
  ],
  api: [
    'AgentBase.run',
    'AgentBase.runServerless',
    'AgentServer',
    'AgentBase.getApp',
    'ServerlessAdapter',
  ],
  related: ['security', 'config', 'testing'],
};

const SECURITY: Topic = {
  name: 'security',
  title: 'Security',
  summary: 'Basic auth, webhook signatures, tool tokens and URL-fetch protection',
  body: `- Basic auth protects every endpoint except the \`/health\` and \`/ready\`
  probes. Set \`SWML_BASIC_AUTH_USER\` and \`SWML_BASIC_AUTH_PASSWORD\`, or pass
  \`basicAuth\`; otherwise the agent generates a password.
- Webhook signatures: with \`signingKey\` (or \`SIGNALWIRE_SIGNING_KEY\`), a POST
  to the SWML route, \`/swaig\`, \`/post_prompt\` or a routing callback must carry
  a valid SignalWire signature. A GET for the SWML document needs only basic
  auth, and so does \`/mcp\`, which checks neither signatures nor tool tokens.
- Tool tokens: a secure tool called through \`/swaig\` runs only with the token
  minted into that call's SWML. \`swaigSecret\` (or \`SIGNALWIRE_SWAIG_SECRET\`)
  keeps tokens valid across replicas and restarts.
- The spider and web_search skills refuse private and internal addresses in
  the URLs they fetch, checking every redirect. The mcp_gateway skill and
  native_vector_search's \`remote_url\` check their URL once, at setup.
  \`SWML_ALLOW_PRIVATE_URLS\` allows private addresses. docs/security.md has
  the details.
- Security is also a design question: what the model can see and request, and
  what the handlers enforce (\`sw-tsdocs pgi\`).
`,
  docs: [
    ['docs/security.md', 'Every security setting and what it protects'],
    ['docs/pgi_agent_guide.md', 'Keeping authority in code, not in the model'],
  ],
  api: ['AgentBase.getBasicAuthCredentials', 'validateRequest', 'SessionManager', 'SslConfig'],
  related: ['deploy', 'config', 'pgi', 'tools'],
};

const CONFIG: Topic = {
  name: 'config',
  title: 'Configuration and environment variables',
  summary: "Config files, precedence, and the SDK's environment variables",
  body: `Settings come from constructor options, then a config file (\`configFile\`),
then environment variables, then defaults, in that order of precedence.
Logging follows \`SIGNALWIRE_LOG_LEVEL\` (debug, info, warn, error), and
\`SIGNALWIRE_LOG_MODE=off\` turns it off.
`,
  docs: [
    ['docs/configuration.md', 'Config file format and lookup'],
    ['docs/agent-guide.md', 'The environment variables section lists the main ones'],
    ['docs/security.md', 'Security-related settings'],
  ],
  api: ['ConfigLoader', 'AgentOptions'],
  related: ['deploy', 'security'],
  live: 'env',
};

const TESTING: Topic = {
  name: 'testing',
  title: 'Testing agents',
  summary: 'Test tools and SWML locally with swaig-test, and in unit tests',
  body: `\`\`\`bash
npx swaig-test agent.ts --list-tools                  # the tools the agent defines
npx swaig-test agent.ts --dump-swml                   # the SWML document it serves
npx swaig-test agent.ts --exec lookup_order --order_id 1234
npx swaig-test agent.ts --simulate-serverless lambda --dump-swml
npx swaig-test agent.ts --verbose --exec lookup_order --order_id 1234  # with logs
\`\`\`

- \`swaig-test\` sends its requests through the agent's own HTTP app, as
  SignalWire would. A \`.ts\` agent file needs a Node.js that runs TypeScript
  (22.18 or later), or run \`swaig-test\` under \`npx tsx\`.
- Files with several agents: pick one with \`--route\` or \`--agent-class\`.
- In unit tests, construct the agent and call \`renderSwml()\`, or test your
  domain code directly. Keep business rules in plain functions so they're
  testable without the SDK.
- A local test doesn't prove the voice path. Place real calls before
  production.
`,
  docs: [
    ['docs/cli-guide.md', "swaig-test's options and simulation"],
    ['docs/pgi_agent_guide.md', 'Testing levels and adversarial scenarios'],
  ],
  examples: ['examples/README.md'],
  api: ['AgentBase.renderSwml'],
  related: ['cli', 'tools', 'datamap'],
};

const TUTORIALS: Topic = {
  name: 'tutorials',
  title: 'Tutorials',
  summary: 'Three complete agents, built lesson by lesson and tested',
  body: `- Fred: a voice agent that answers questions from Wikipedia, with a
  skill, custom tools, swaig-test and Docker.
- Penny: a reservation line that keeps its rules when the model
  misunderstands or a caller pushes. Every step names its tools, code moves
  the conversation, and the business rules live outside the SDK. A worked
  example of Programmatically Governed Inference (\`sw-tsdocs pgi\`).
- Multi-agent: a sales agent with knowledge-base search, then a triage agent
  that hands callers to specialists on one AgentServer.
- Each tutorial's lessons quote its real code, and its tests run in the SDK's
  own test suite.
`,
  docs: [
    ['tutorial/fred/tutorial/README.md', 'Fred, the Wikipedia agent'],
    ['tutorial/full-guardrails-agent/tutorial/README.md', 'Penny, the full-guardrails agent'],
    ['tutorial/multi_agents/README.md', 'The multi-agent tutorial'],
  ],
  examples: [],
  api: ['AgentServer'],
  related: ['pgi', 'skills', 'contexts'],
};

const CLI: Topic = {
  name: 'cli',
  title: 'Command-line tools',
  summary: 'The commands the SDK installs',
  body: `Run them with \`npx\` in a project that depends on \`@signalwire/sdk\`. Each
takes \`--help\`. \`swaig-test\` is documented in the CLI guide.
`,
  docs: [['docs/cli-guide.md', "swaig-test's options, actions and simulation"]],
  related: ['testing'],
  live: 'cli',
};

const PGI: Topic = {
  name: 'pgi',
  title: 'Designing agents that stay within their rules (PGI)',
  summary: 'What the model decides, what code enforces: read before building a real agent',
  body: `Programmatically Governed Inference (PGI): program what the model can see and
request at each stage, while software stays responsible for what actually
happens. The model interprets language and picks from the tools you expose.
Your code owns identity, authorization, business rules, state changes and
side effects.

- A tool call is a request, not an authorization. Check it in the handler.
- Expose only the tools the current step needs, and set them on every step.
- Move between steps from code (\`swmlChangeStep()\`) when a check must pass
  first. A prompt, a step's criteria or a model-supplied \`approved: true\` is
  never the only enforcement.
- \`global_data\` is session data, not a database. Keep per-caller state off the
  shared agent instance.
- A tool's response is context for the model, not speech.
- The substitution test: if the model were replaced by a scripted UI, would
  the backend still enforce the same rules?

The guide has the full rules, a capability index, a tested reference
implementation (\`examples/pgi/\`), and testing and review checklists.
`,
  docs: [
    ['docs/pgi_agent_guide.md', 'The PGI implementation guide for coding agents'],
    [
      'docs/programmatically_governed_inference.md',
      'The discipline itself: why the model gets no authority, and the four constraint layers',
    ],
    [
      'docs/developer_pain_points.md',
      'The problems the guide cites, what the SDK and platform provide, and what stays yours',
    ],
  ],
  examples: ['examples/pgi/'],
  api: ['Step.setFunctions', 'FunctionResult.swmlChangeStep', 'FunctionResult'],
  related: ['tools', 'contexts', 'security', 'testing'],
};

/** Every topic, in the order the index lists them. */
export const TOPICS: readonly Topic[] = [
  QUICKSTART,
  AGENTS,
  PROMPTS,
  TOOLS,
  DATAMAP,
  CONTEXTS,
  SKILLS,
  PREFABS,
  PGI,
  SWML,
  RELAY,
  REST,
  LIVEWIRE,
  MCP,
  CHAT,
  BEDROCK,
  DEPLOY,
  SECURITY,
  CONFIG,
  TESTING,
  TUTORIALS,
  CLI,
];

/** The topics by name. */
export const TOPICS_BY_NAME: ReadonlyMap<string, Topic> = new Map(TOPICS.map((t) => [t.name, t]));

/** How the index groups the topics. */
export const TOPIC_GROUPS: readonly (readonly [string, readonly string[]])[] = [
  [
    'Build AI agents',
    [
      'quickstart',
      'agents',
      'prompts',
      'tools',
      'datamap',
      'contexts',
      'skills',
      'prefabs',
      'pgi',
      'tutorials',
    ],
  ],
  ['Call control and APIs', ['swml', 'relay', 'rest']],
  ['Integrations', ['livewire', 'mcp', 'chat', 'bedrock']],
  ['Run and test', ['deploy', 'security', 'config', 'testing', 'cli']],
];

/** The index's "start here" rows: what you want to do, and the topics to read. */
export const START_HERE: readonly (readonly [string, readonly string[]])[] = [
  ['Answer calls with an AI agent', ['quickstart', 'agents']],
  ['Design an agent that takes real actions safely', ['pgi']],
  ['Learn by building a complete agent', ['tutorials']],
  ['Give an agent tools', ['tools', 'datamap', 'skills']],
  ['Build a multi-step workflow', ['contexts']],
  ['Control live calls from code', ['relay']],
  ['Manage numbers and resources', ['rest']],
  ['Route calls without AI', ['swml']],
  ['Chat with an agent from a web page', ['chat']],
  ['Deploy', ['deploy', 'security']],
  ['Test without a phone call', ['testing']],
];

/** The index's short list of rules that prevent the most common mistakes. */
export const RULES_OF_THUMB: readonly string[] = [
  'Check names and signatures with `sw-tsdocs api` instead of recalling them: ' +
    'the API changes between versions, and it differs from the Python SDK (camelCase, options objects).',
  'A tool call is a request from the model, not an authorization. Enforce ' +
    'identity, state and business rules in the handler.',
  "A tool's response is context for the model, not speech. Keep facts " +
    '(`tool_result`) apart from instructions (`tool_prompt`).',
  'Set the tools on every step of a workflow, and move between steps from code ' +
    'when a check must pass first.',
  'Keep per-caller state off the shared agent instance. `global_data` lasts for ' +
    'the call; anything durable belongs in your own storage.',
  'Test with `swaig-test` before a live call, and with a live call before production.',
];
