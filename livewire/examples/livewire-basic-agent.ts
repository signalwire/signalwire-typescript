/**
 * Example: Basic LiveWire agent with a single tool.
 *
 * Demonstrates the simplest possible LiveWire agent: an AI assistant
 * with one function tool.  This mirrors the standard @livekit/agents-js
 * pattern -- just with a different import path.
 *
 * Run:
 *   npx tsx livewire/examples/livewire-basic-agent.ts
 *
 * Then point a SignalWire phone number at http://your-host:3000/
 */

import {
  Agent,
  AgentSession,
  tool,
  defineAgent,
  runApp,
  type JobContext,
} from '../../src/livewire/index.js';

// Define a weather tool
const getWeather = tool({
  description: 'Get current weather for a location',
  parameters: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'City name' },
    },
    required: ['location'],
  },
  execute: (params: { location: string }) => {
    // In production, call a real weather API here
    return `The weather in ${params.location} is sunny, 72F with clear skies.`;
  },
});

// Define the agent using LiveKit-compatible API
const agentDef = defineAgent({
  entry: async (ctx: JobContext) => {
    // Connect is a noop on SignalWire -- the platform handles
    // connection lifecycle automatically.
    await ctx.connect();

    // Configure the session.  STT and TTS are noops -- SignalWire's
    // control plane handles the media pipeline.  LLM model selection
    // is honored.
    const session = new AgentSession({
      stt: 'deepgram',
      llm: 'openai/gpt-4',
      tts: 'elevenlabs',
    });

    // Create an agent with instructions and a tool
    const agent = new Agent({
      instructions:
        'You are a helpful weather assistant. When asked about weather, use the get_weather tool.',
      tools: { get_weather: { ...getWeather, name: 'get_weather' } },
    });

    // Start the session -- this binds the agent to SignalWire's
    // AgentBase and registers all tools.
    await session.start({ agent });

    // Generate an initial greeting
    session.generateReply({
      instructions: 'Greet the user and ask how you can help with weather information.',
    });
  },
});

// Start the LiveWire agent
runApp(agentDef);
