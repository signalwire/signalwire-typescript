/**
 * Example: Multi-agent with AgentHandoff.
 *
 * Demonstrates how to use AgentHandoff to switch between different
 * agents within a single session.  The triage agent determines the
 * caller's intent and hands off to a specialized agent.
 *
 * Run:
 *   npx tsx livewire/examples/livewire-handoff.ts
 *
 * Then point a SignalWire phone number at http://your-host:3000/
 */

import {
  Agent,
  AgentSession,
  AgentHandoff,
  tool,
  handoff,
  defineAgent,
  runApp,
  type JobContext,
} from '../../src/livewire/index.js';

// ---------------------------------------------------------------------------
// Sales Agent
// ---------------------------------------------------------------------------

function createSalesAgent(): Agent {
  const getPricing = tool({
    description: 'Get pricing for a product',
    parameters: {
      type: 'object',
      properties: {
        product: { type: 'string', description: 'Product name' },
      },
      required: ['product'],
    },
    execute: (params: { product: string }) => {
      console.log(`[sales] get_pricing called for: ${params.product}`);
      return (
        `The ${params.product} is available at $29.99/month or $299/year (save 17%). ` +
        'We also offer a 30-day free trial.'
      );
    },
  });

  const createOrder = tool({
    description: 'Create an order for a product',
    parameters: {
      type: 'object',
      properties: {
        product: { type: 'string', description: 'Product name' },
        plan: { type: 'string', description: 'Pricing plan (monthly or annual)' },
      },
      required: ['product', 'plan'],
    },
    execute: (params: { product: string; plan: string }) => {
      console.log(`[sales] create_order: product=${params.product} plan=${params.plan}`);
      return (
        `Order created! You're now subscribed to ${params.product} on the ${params.plan} plan. ` +
        'A confirmation email will arrive shortly.'
      );
    },
  });

  return new Agent({
    instructions:
      'You are a sales specialist at Acme Corp. You help customers ' +
      'find the right products and process orders. Be enthusiastic ' +
      'but not pushy. Always mention our satisfaction guarantee.',
    tools: {
      get_pricing: { ...getPricing, name: 'get_pricing' },
      create_order: { ...createOrder, name: 'create_order' },
    },
  });
}

// ---------------------------------------------------------------------------
// Support Agent
// ---------------------------------------------------------------------------

function createSupportAgent(): Agent {
  const checkSystemStatus = tool({
    description: 'Check current system status',
    execute: () => {
      console.log('[support] check_system_status called');
      return 'All systems operational. API uptime: 99.99%. No known issues.';
    },
  });

  const resetPassword = tool({
    description: 'Send a password reset email',
    parameters: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'User email address' },
      },
      required: ['email'],
    },
    execute: (params: { email: string }) => {
      console.log(`[support] reset_password called for: ${params.email}`);
      return `Password reset email sent to ${params.email}. The link expires in 30 minutes.`;
    },
  });

  const createTicket = tool({
    description: 'Create a support ticket',
    parameters: {
      type: 'object',
      properties: {
        issue: { type: 'string', description: 'Description of the issue' },
        priority: { type: 'string', description: 'Priority level: low, medium, high' },
      },
      required: ['issue', 'priority'],
    },
    execute: (params: { issue: string; priority: string }) => {
      console.log(`[support] create_ticket: issue=${params.issue} priority=${params.priority}`);
      return (
        `Support ticket #TKT-10042 created with ${params.priority} priority. ` +
        'Our team will respond within 4 hours.'
      );
    },
  });

  return new Agent({
    instructions:
      'You are a technical support specialist at Acme Corp. You help ' +
      'customers troubleshoot issues, reset passwords, and resolve ' +
      'technical problems. Be patient and thorough.',
    tools: {
      check_system_status: { ...checkSystemStatus, name: 'check_system_status' },
      reset_password: { ...resetPassword, name: 'reset_password' },
      create_ticket: { ...createTicket, name: 'create_ticket' },
    },
  });
}

// ---------------------------------------------------------------------------
// Triage Agent (entry point)
// ---------------------------------------------------------------------------

const agentDef = defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();

    // Pre-build the specialized agents
    const salesAgent = createSalesAgent();
    const supportAgent = createSupportAgent();

    const session = new AgentSession({
      llm: 'openai/gpt-4',
    });

    // Create handoff tools for the triage agent
    const handoffToSales = tool({
      description: 'Transfer the caller to the sales department',
      execute: () => {
        console.log('[triage] Handing off to sales agent');
        session.say('Let me connect you to our sales team.');
        // In a full implementation, handoff() would trigger a session swap
        const _h = handoff({ agent: salesAgent });
        return 'Connecting you to our sales team now.';
      },
    });

    const handoffToSupport = tool({
      description: 'Transfer the caller to technical support',
      execute: () => {
        console.log('[triage] Handing off to support agent');
        session.say('Let me connect you to our technical support team.');
        const _h = handoff({ agent: supportAgent });
        return 'Connecting you to our technical support team now.';
      },
    });

    const triageAgent = new Agent({
      instructions:
        'You are the front-desk receptionist at Acme Corp. Your job is to ' +
        'understand what the caller needs and route them to the right department. ' +
        'Ask clarifying questions if needed, then use the appropriate handoff tool.',
      tools: {
        handoff_to_sales: { ...handoffToSales, name: 'handoff_to_sales' },
        handoff_to_support: { ...handoffToSupport, name: 'handoff_to_support' },
      },
    });

    await session.start({ agent: triageAgent });
    session.generateReply({
      instructions:
        'Welcome the caller to Acme Corp. Ask whether they need help ' +
        'with sales, purchasing, or technical support.',
    });
  },
});

runApp(agentDef);
