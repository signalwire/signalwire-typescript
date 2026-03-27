/**
 * TAP (Media Tap) Example
 *
 * Demonstrates using the TAP action to stream call audio to an
 * external RTP endpoint for real-time processing (e.g., analytics,
 * transcription, or recording to an external system).
 * Run: npx tsx examples/tap.ts
 */

import { AgentBase, FunctionResult } from '../src/index.js';

export const agent = new AgentBase({
  name: 'tap-agent',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText(
  'You are a helpful assistant. The call audio can be streamed to ' +
  'an external system for real-time processing. You can start and stop ' +
  'the audio tap when the caller requests it.',
);

// Start audio streaming via TAP
agent.defineTool({
  name: 'start_tap',
  description: 'Start streaming call audio to an external RTP endpoint',
  parameters: {
    uri: {
      type: 'string',
      description: 'RTP URI to stream audio to (e.g., rtp://192.168.1.100:5000)',
    },
  },
  handler: (args) => {
    const result = new FunctionResult(
      'Audio streaming started. Call audio is now being sent to the external system.',
    );
    result.tap({
      uri: args.uri as string,
      controlId: 'main-tap',
      direction: 'both',
      codec: 'PCMU',
    });
    return result;
  },
});

// Stop audio streaming
agent.defineTool({
  name: 'stop_tap',
  description: 'Stop streaming call audio to the external endpoint',
  parameters: {},
  handler: () => {
    const result = new FunctionResult(
      'Audio streaming stopped.',
    );
    result.stopTap('main-tap');
    return result;
  },
});

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });
agent.addHints(['tap', 'stream', 'RTP', 'audio']);

agent.run();
