/**
 * SWML Service Routing Example
 *
 * Demonstrates dynamic SWML routing using SWMLService's onRequestCallback.
 * Different SWML documents are generated based on query parameters,
 * enabling a single endpoint to serve multiple call flows.
 * Run: npx tsx examples/swml-service-routing.ts
 * Test:
 *   curl http://user:pass@localhost:3000/?dept=sales
 *   curl http://user:pass@localhost:3000/?dept=support
 *   curl http://user:pass@localhost:3000/  (default IVR)
 */

import { SWMLService, SwmlBuilder } from '../src/index.js';

export const agent = new SWMLService({
  name: 'ivr-router',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

// Dynamic routing: build different SWML based on request parameters
agent.setOnRequestCallback(async (queryParams, _bodyParams, _headers) => {
  const builder = new SwmlBuilder();
  const dept = queryParams['dept'];

  builder.addVerb('answer', { max_duration: 300 });

  if (dept === 'sales') {
    builder.addVerb('play', {
      url: 'say:Thank you for calling the sales department. Please hold while we connect you.',
    });
    builder.addVerb('connect', {
      from: '+15551234567',
      to: '+15559876543',
    });
  } else if (dept === 'support') {
    builder.addVerb('play', {
      url: 'say:Thank you for calling technical support. Your call is important to us.',
    });
    builder.addVerb('record', {
      stereo: true,
      format: 'mp3',
      beep: true,
      terminators: '#',
    });
  } else {
    // Default IVR menu
    builder.addVerb('play', {
      url: 'say:Welcome to Acme Corp. Press 1 for sales, 2 for support, or stay on the line for the operator.',
    });
    builder.addVerb('sleep', 3);
    builder.addVerb('play', {
      url: 'say:Connecting you to an operator. Please hold.',
    });
  }

  builder.addVerb('hangup', {});

  return builder;
});

agent.run();
