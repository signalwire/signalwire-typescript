/**
 * PC Builder Pro - multi-agent service (Lesson 3)
 *
 * Three agents on one AgentServer:
 * - Triage agent (/): greets the caller and routes them to a specialist
 * - Sales agent (/sales): product recommendations, with a search tool over sales_knowledge.md
 * - Support agent (/support): troubleshooting, with a search tool over support_knowledge.md
 *
 * The triage agent hands the call off with the swml_transfer skill. Its
 * required_fields make the model collect the caller's name and a summary
 * before the transfer, and save them in global data as `call_data`, where the
 * specialists' prompts read them as ${call_data.user_name} and ${call_data.summary}.
 *
 * Run: npx tsx tutorial/multi_agents/pc_builder.ts
 */

import { randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  AgentBase,
  AgentServer,
  FunctionResult,
  NativeVectorSearchSkill,
  ServerlessAdapter,
  SwmlTransferSkill,
  getLogger,
  type ServerlessEvent,
} from '@signalwire/sdk';
import { loadKnowledge } from './knowledge.js';

const log = getLogger('pc_builder');

/** Where the service listens, and the credentials all three agents accept. */
export interface PcBuilderOptions {
  host?: string;
  port?: number;
  basicAuth?: [string, string];
  logLevel?: string;
}

/** The options each agent is constructed with: the server's address and credentials. */
type AgentOptions = { host: string; port: number; basicAuth?: [string, string] };

const knowledgeFile = (name: string): string =>
  fileURLToPath(new URL(`./${name}`, import.meta.url));

// region: triage-agent
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
// endregion: triage-agent

// region: transfer-tools
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
// endregion: transfer-tools

/** The triage agent's prompt. */
function configureTriagePrompt(agent: AgentBase): void {
  agent.promptAddSection('AI Role', {
    body:
      'You are Alex, the friendly front desk assistant at PC Builder Pro. ' +
      "You're enthusiastic about technology and love helping customers find " +
      'the right specialist for their needs. Introduce yourself by name when ' +
      'greeting customers.',
  });
  agent.promptAddSection('Your Tasks', {
    body: 'Guide customers through the initial triage process with enthusiasm and energy.',
    bullets: [
      'Greet the customer warmly with your signature enthusiasm',
      'Ask for their name in a friendly way',
      'Determine if they need sales (buying/building) or support (technical issues)',
      'Get a brief description of what they need help with',
      'Prepare a comprehensive summary before transferring',
      'Use transfer_to_specialist with both the destination and summary',
    ],
  });
  agent.promptAddSection('Voice Instructions', {
    body: 'Speak with energy and enthusiasm about technology.',
  });
  agent.promptAddSection('Important', {
    body: 'Follow these key guidelines for effective triage:',
    bullets: [
      "Always get the customer's name first",
      'Ask clarifying questions to determine sales vs support',
      'The transfer_to_specialist function requires specialist_type, user_name AND summary',
      'Include customer name, their needs, and reason for transfer in the summary',
    ],
  });
  agent.promptAddSection('Summary Example', {
    body:
      "When transferring, provide a summary like: 'Customer John Smith is " +
      'interested in building a gaming PC with a budget of $2000. He needs ' +
      'help selecting compatible components and wants recommendations for ' +
      "the best performance within his budget.'",
  });
}

// region: sales-agent
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
// endregion: sales-agent

// region: sales-greeting
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
// endregion: sales-greeting

/** The sales agent's prompt. */
function configureSalesPrompt(agent: AgentBase): void {
  agent.promptAddSection('AI Role', {
    body:
      'You are Morgan, a passionate PC building expert and sales specialist ' +
      "at PC Builder Pro. You're known for your deep knowledge of components " +
      'and your ability to match customers with their perfect build. You get ' +
      'excited about the latest hardware and love sharing that enthusiasm. ' +
      'Always introduce yourself by name.',
  });
  agent.promptAddSection('Your Expertise', {
    body: 'Areas of specialization:',
    bullets: [
      'Custom PC builds for all budgets',
      'Component compatibility and optimization',
      'Performance recommendations',
      'Price/performance analysis',
      'Current market trends',
    ],
  });
  agent.promptAddSection('Your Tasks', {
    body: 'Complete sales process workflow with passion and expertise:',
    bullets: [
      'Understand their specific PC building requirements with genuine interest',
      'Ask about budget, intended use, and preferences enthusiastically',
      'Search knowledge base for current product info',
      'Create customized build recommendations with excitement about the possibilities',
      'Help with component selection and compatibility while sharing your expertise',
    ],
  });
  agent.promptAddSection('Voice Instructions', {
    body:
      'Share your passion for PC building and get excited about ' +
      'helping customers create their perfect system.',
  });
  agent.promptAddSection('Tools Available', {
    body: 'Use these tools to assist customers:',
    bullets: [
      'search_sales_knowledge: Find current product information',
      'create_build_recommendation: Generate custom build suggestions',
      'check_component_compatibility: Verify component compatibility',
    ],
  });
  agent.promptAddSection('Important', {
    body: 'Key guidelines for sales interactions:',
    bullets: [
      'Ask clarifying questions about their specific requirements',
      'Use search to get current pricing and availability',
      'Provide detailed explanations for recommendations',
    ],
  });
}

/** Sam, the support specialist at /support. */
export async function createSupportAgent(options: AgentOptions): Promise<AgentBase> {
  const agent = new AgentBase({
    name: 'PC Builder Support Specialist',
    route: '/support',
    ...options,
  });

  agent.setDynamicConfigCallback(configureSupportGreeting);

  configureSupportPrompt(agent);
  agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rime.cove' });

  await agent.addSkill(
    new NativeVectorSearchSkill({
      tool_name: 'search_support_knowledge',
      description: 'Search technical support and troubleshooting information',
      documents: loadKnowledge(knowledgeFile('support_knowledge.md')),
      count: 3,
    }),
  );

  agent.defineTool({
    name: 'diagnose_hardware_issue',
    description: 'Help diagnose PC hardware problems',
    parameters: {
      symptoms: { type: 'string', description: 'What the customer sees or hears' },
      system_specs: { type: 'string', description: "The customer's components, if known" },
    },
    required: ['symptoms', 'system_specs'],
    handler: ({ symptoms, system_specs }) =>
      new FunctionResult(
        `For symptoms '${symptoms}' on system '${system_specs}': ` +
          '[Diagnostic steps and potential solutions would be provided here]',
      ),
  });

  agent.defineTool({
    name: 'create_support_ticket',
    description: 'Create a support ticket for complex issues',
    parameters: {
      issue_description: { type: 'string', description: 'The problem, in a sentence or two' },
      customer_info: { type: 'string', description: "The customer's name and contact details" },
      priority: { type: 'string', description: 'low, medium or high' },
    },
    required: ['issue_description', 'customer_info', 'priority'],
    handler: ({ issue_description, priority }) => {
      // SUP-YYYYMMDD-HHMMSS, from the current UTC time
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
      return new FunctionResult(
        `Support ticket SUP-${stamp} created for: ${issue_description}. ` +
          `Priority: ${priority}. We'll follow up within 24 hours.`,
      );
    },
  });

  return agent;
}

/** Runs for every request to the support agent, on that request's copy of it. */
export function configureSupportGreeting(
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
        'Start by greeting them by name and acknowledging their technical issue',
        "Example: 'Hi ${call_data.user_name}, I'm Sam. I understand you're " +
          "experiencing issues with your PC not booting. Let's work through " +
          "this together and get your system back up and running.'",
      ],
    });
  } else {
    agent.promptAddSection('Initial Greeting', {
      body: 'This is a direct call to the support department.',
      bullets: [
        'Greet the customer warmly and professionally',
        'Introduce yourself as a technical support specialist',
        'Ask for their name',
        "Ask what technical issue they're experiencing",
        "Example: 'Hello! Welcome to PC Builder Pro technical support. " +
          "I'm Sam, and I'm here to help solve any technical issues you're " +
          "facing. May I have your name, and what can I help you troubleshoot today?'",
      ],
    });
  }
}

/** The support agent's prompt. */
function configureSupportPrompt(agent: AgentBase): void {
  agent.promptAddSection('AI Role', {
    body:
      'You are Sam, a patient and methodical technical support specialist at ' +
      'PC Builder Pro. You have a calming presence and excel at breaking down ' +
      "complex technical problems into simple steps. You're known for never " +
      "giving up on a problem until it's solved. Always introduce yourself by name.",
  });
  agent.promptAddSection('Your Expertise', {
    body: 'Areas of technical specialization:',
    bullets: [
      'Hardware troubleshooting and diagnostics',
      'Software compatibility issues',
      'System optimization and performance',
      'Component failure analysis',
      'Warranty and repair processes',
    ],
  });
  agent.promptAddSection('Your Tasks', {
    body: 'Complete support process workflow with patience and thoroughness:',
    bullets: [
      'Understand their specific technical problems with careful listening',
      'Search knowledge base for solutions methodically',
      'Guide through diagnostic steps one at a time',
      'Provide troubleshooting solutions with clear explanations',
      'Create support tickets for complex issues when needed',
    ],
  });
  agent.promptAddSection('Voice Instructions', {
    body: 'Maintain a calm, patient tone that reassures customers their problems will be solved.',
  });
  agent.promptAddSection('Tools Available', {
    body: 'Use these tools to resolve issues:',
    bullets: [
      'search_support_knowledge: Find technical solutions',
      'diagnose_hardware_issue: Analyze hardware problems',
      'create_support_ticket: Escalate complex issues',
    ],
  });
  agent.promptAddSection('Important', {
    body: 'Key guidelines for support interactions:',
    bullets: [
      'Ask detailed questions about the problem',
      'Use search to find known solutions',
      'Guide step-by-step through troubleshooting',
      'Be patient and thorough',
    ],
  });
}

// region: server
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
// endregion: server

// region: credentials
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
// endregion: credentials

/** What GET /info returns. */
function serviceInfo(host: string, port: number): Record<string, unknown> {
  return {
    message: 'PC Builder Pro - Multi-Agent Service',
    agents: {
      triage: {
        endpoint: '/',
        description: 'Greets customers and routes to specialists with automatic context collection',
      },
      sales: {
        endpoint: '/sales',
        description: 'PC building sales and recommendations specialist',
      },
      support: {
        endpoint: '/support',
        description: 'Technical support and troubleshooting specialist',
      },
    },
    features: {
      context_sharing: 'Uses swml_transfer skill with user_name and summary requirements',
      pom_prompts: 'Structured prompts using Prompt Object Model',
      summary_access:
        'Transfer context available via ${call_data.user_name} and ${call_data.summary}',
      multi_agent: 'Three specialized agents working together',
    },
    usage: {
      triage_swml: `GET/POST http://${host}:${port}/`,
      sales_swml: `GET/POST http://${host}:${port}/sales`,
      support_swml: `GET/POST http://${host}:${port}/support`,
    },
  };
}

// region: main
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
// endregion: main

// region: lambda
/** AWS Lambda entry point: the same three agents, through ServerlessAdapter. */
export const lambdaHandler: (event: ServerlessEvent) => Promise<unknown> =
  ServerlessAdapter.createLambdaHandler(server.getApp());
// endregion: lambda
