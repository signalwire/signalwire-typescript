/**
 * Serverless Lambda Example
 *
 * Deploy an agent on AWS Lambda using ServerlessAdapter.
 * The adapter converts Lambda events to/from standard HTTP requests.
 *
 * This module is the Lambda handler: it exports `handler` (and `agent`) and
 * doesn't start a server. In the function's environment, set
 * SIGNALWIRE_SWAIG_SECRET so every instance signs tool tokens with the same
 * secret, and SIGNALWIRE_SIGNING_KEY to check SignalWire's request
 * signatures; the agent reads both.
 *
 * Try it locally without Lambda:
 *   npx tsx src/cli/swaig-test.ts examples/serverless-lambda.ts --dump-swml
 *   npx tsx src/cli/swaig-test.ts examples/serverless-lambda.ts --exec get_time
 * To serve it over HTTP during development, call agent.serve() from a
 * separate script that imports `agent` from this module.
 */

import { AgentBase, ServerlessAdapter, FunctionResult } from '@signalwire/sdk';

// Create the agent as usual
export const agent = new AgentBase({
  name: 'lambda-agent',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText('You are a helpful assistant deployed on AWS Lambda.');
agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

agent.defineTool({
  name: 'get_time',
  description: 'Get the current time',
  parameters: {},
  handler: () => new FunctionResult(`The time is ${new Date().toISOString()}`),
});

// Create a Lambda handler from the agent's Hono app
export const handler = ServerlessAdapter.createLambdaHandler(agent.getApp());
