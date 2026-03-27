/**
 * Multi-Endpoint Example
 *
 * An AgentServer hosting multiple agents at different SWML routes,
 * with a shared static file directory and custom health endpoint.
 * Run: npx tsx examples/multi-endpoint.ts
 * Test:
 *   curl http://user:pass@localhost:3000/billing
 *   curl http://user:pass@localhost:3000/tech-support
 *   curl http://localhost:3000/            (agent listing)
 *   curl http://localhost:3000/health
 */

import { AgentBase, AgentServer, FunctionResult } from '../src/index.js';

// --- Billing Agent ---
const billing = new AgentBase({
  name: 'billing',
  route: '/billing',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

billing.setPromptText(
  'You are a billing specialist. Help callers with invoices, payments, and account balances.',
);

billing.defineTool({
  name: 'get_balance',
  description: 'Get the account balance for a customer',
  parameters: {
    account_id: { type: 'string', description: 'Customer account ID' },
  },
  handler: (args) => {
    return new FunctionResult(
      `Account ${args.account_id}: Balance is $142.50. Last payment: $50.00 on Jan 15.`,
    );
  },
});

billing.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

// --- Tech Support Agent ---
const techSupport = new AgentBase({
  name: 'tech-support',
  route: '/tech-support',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

techSupport.setPromptText(
  'You are a technical support specialist. Help diagnose and resolve product issues.',
);

techSupport.defineTool({
  name: 'run_diagnostic',
  description: 'Run a remote diagnostic on the customer device',
  parameters: {
    device_id: { type: 'string', description: 'Device serial number' },
  },
  handler: (args) => {
    return new FunctionResult(
      `Diagnostic for device ${args.device_id}: All systems normal. Firmware: v2.3.1 (up to date).`,
    );
  },
});

techSupport.addLanguage({ name: 'English', code: 'en-US', voice: 'dave' });
techSupport.setParam('temperature', 0.2);

// --- Server ---
const server = new AgentServer({ port: 3000 });
server.register(billing);
server.register(techSupport);
server.run();
