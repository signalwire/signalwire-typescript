# Migrating a LiveKit Agent to LiveWire

This guide walks through converting an existing LiveKit voice agent (TypeScript / @livekit/agents-js) to run on SignalWire's platform using LiveWire. The process is mechanical -- mostly import path changes -- because LiveWire mirrors LiveKit's API surface.

## Step 1: Change the Import Path

Replace all LiveKit agent imports with the LiveWire module:

<!-- snippet: no-compile before/after import comparison; the "Before" half imports the external `@livekit/*` packages that this SDK does not depend on -->
```typescript
// Before (LiveKit)
import { defineAgent, type JobContext } from '@livekit/agents';
import { AgentSession } from '@livekit/agents/voice';
import { tool } from '@livekit/agents/llm';
import { DeepgramSTT } from '@livekit/agents-plugin-deepgram';
import { ElevenLabsTTS } from '@livekit/agents-plugin-elevenlabs';
import { SileroVAD } from '@livekit/agents-plugin-silero';

// After (LiveWire)
import {
  defineAgent, JobContext, AgentSession, Agent, tool, RunContext,
  plugins, runApp,
} from '@signalwire/sdk/livewire';
```

All types are in a single module. No separate plugin packages needed.

## Step 2: Update Type References

Replace LiveKit type names with their LiveWire equivalents. In most cases the names are identical:

<!-- snippet: no-compile before/after comparison fused in one fence; the "Before" half imports the external `@livekit/agents/voice` package and redeclares the same names as the "After" half -->
```typescript
// Before (LiveKit)
import { Agent } from '@livekit/agents/voice';
const agent = new Agent({ instructions: 'Hello' });

// After (LiveWire)
import { Agent } from '@signalwire/sdk/livewire';
const agent = new Agent({ instructions: 'Hello' });
```

## Step 3: Update Session Options

LiveWire provides the same session options. STT, TTS, and VAD are accepted but are noops -- SignalWire's control plane handles the media pipeline. LLM model selection is honored.

<!-- snippet: no-compile before/after comparison; the "Before" half uses LiveKit plugin classes (DeepgramSTT/ElevenLabsTTS/SileroVAD/OpenAILLM) from external packages and redeclares `session` -->
```typescript
// Before (LiveKit)
const session = new AgentSession({
  stt: new DeepgramSTT(),
  tts: new ElevenLabsTTS(),
  vad: SileroVAD.load(),
  llm: new OpenAILLM({ model: 'gpt-4' }),
});

// After (LiveWire)
const session = new AgentSession({
  stt: 'deepgram',           // noop -- platform handles STT
  tts: 'elevenlabs',         // noop -- platform handles TTS
  vad: plugins.SileroVAD.load(),  // noop -- platform handles VAD
  llm: 'openai/gpt-4',      // model selection is honored
});
```

## Step 4: Update Tool Definitions

LiveWire uses the same `tool()` function:

<!-- snippet: no-compile before/after comparison; the "Before" half imports the external `@livekit/agents/llm` package plus Zod (`z`) and redeclares `getWeather` -->
```typescript
// Before (LiveKit)
import { tool } from '@livekit/agents/llm';

const getWeather = tool({
  description: 'Get weather for a location',
  parameters: z.object({ location: z.string() }),
  execute: async ({ location }) => `Sunny in ${location}`,
});

// After (LiveWire)
import { tool } from '@signalwire/sdk/livewire';

const getWeather = tool({
  description: 'Get weather for a location',
  parameters: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'City name' },
    },
  },
  execute: (params: { location: string }) => `Sunny in ${params.location}`,
});
```

Note: LiveWire accepts both Zod schemas and plain JSON Schema objects for parameters.

## Step 5: Update the Entrypoint

<!-- snippet: no-compile before/after comparison fused in one fence; two default exports and `defineAgent` is only imported in prose elsewhere -->
```typescript
// Before (LiveKit)
export default defineAgent({
  prewarm: async (proc) => { /* warmup */ },
  entry: async (ctx) => {
    await ctx.connect();
    // ... create session, agent, tools ...
  },
});

// After (LiveWire)
export default defineAgent({
  prewarm: (proc) => { /* warmup -- noop on SignalWire */ },
  entry: async (ctx) => {
    await ctx.connect();   // noop on SignalWire
    // ... create session, agent, tools ...
  },
});
```

## Step 6: Remove Infrastructure Configuration

LiveKit agents typically have configuration for:

- STT API keys and endpoints
- TTS API keys and endpoints
- VAD model paths
- LLM API keys
- WebRTC TURN/STUN servers
- Room service URLs

With LiveWire, none of this is needed. SignalWire's platform manages the entire media pipeline. You can delete all infrastructure configuration.

The only configuration you need:

```bash
# For the agent HTTP server
export PORT=3000  # optional, defaults to 3000

# If using RELAY or REST features
export SIGNALWIRE_PROJECT_ID=your-project-id
export SIGNALWIRE_API_TOKEN=your-api-token
```

## Step 7: Deploy

LiveWire agents are standard HTTP servers. Deploy them anywhere:

```bash
# Build
npx tsc

# Run
node dist/my-agent.js
```

Point your SignalWire phone number at the agent's URL and calls will flow through automatically.

## Complete Before/After Example

### Before (LiveKit)

<!-- snippet: no-compile the "Before" LiveKit reference example; imports the external `@livekit/*` packages this SDK does not depend on -->
```typescript
import { defineAgent, type JobContext } from '@livekit/agents';
import { AgentSession } from '@livekit/agents/voice';
import { tool, Agent } from '@livekit/agents/llm';
import { DeepgramSTT } from '@livekit/agents-plugin-deepgram';
import { ElevenLabsTTS } from '@livekit/agents-plugin-elevenlabs';
import { SileroVAD } from '@livekit/agents-plugin-silero';

const greet = tool({
  description: 'Greet someone by name',
  parameters: z.object({ name: z.string() }),
  execute: async ({ name }) => `Hello, ${name}!`,
});

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();
    const session = new AgentSession({
      stt: new DeepgramSTT(),
      tts: new ElevenLabsTTS(),
      vad: SileroVAD.load(),
    });
    const agent = new Agent({
      instructions: 'You are a helpful assistant.',
      tools: { greet },
    });
    await session.start({ agent, room: ctx.room });
  },
});
```

### After (LiveWire)

<!-- snippet: no-run imports the @signalwire/sdk/livewire subpath which is not a resolvable package export standalone -->
```typescript
import {
  defineAgent, JobContext, AgentSession, Agent, tool,
  plugins, runApp,
} from '@signalwire/sdk/livewire';

const greet = tool({
  description: 'Greet someone by name',
  parameters: {
    type: 'object',
    properties: { name: { type: 'string', description: 'Name to greet' } },
  },
  execute: (params: { name: string }) => `Hello, ${params.name}!`,
});

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();
    const session = new AgentSession({
      stt: 'deepgram',
      tts: 'elevenlabs',
      vad: plugins.SileroVAD.load(),
      llm: 'openai/gpt-4',
    });
    const agent = new Agent({
      instructions: 'You are a helpful assistant.',
      tools: [{ ...greet, name: 'greet' }],
    });
    await session.start({ agent });
  },
});
```

The code is nearly identical. The differences are:

1. Single import path instead of multiple plugin packages
2. Provider names are strings instead of class instances
3. Everything runs on SignalWire's infrastructure -- no STT/TTS/VAD services to manage
