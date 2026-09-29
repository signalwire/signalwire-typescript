# Migrating a LiveKit Agent to LiveWire

This guide converts an existing LiveKit voice agent, written in TypeScript with `@livekit/agents`, to run on SignalWire with LiveWire. Most of the work is changing import paths, because LiveWire uses LiveKit's class and function names. A few LiveKit features behave differently or aren't implemented; [What LiveWire Ignores](../README.md#what-livewire-ignores) lists them.

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

Every LiveWire name comes from one module, so you don't install plugin packages.

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

LiveWire accepts the same session options. It ignores the STT, TTS and VAD options, because SignalWire's control plane runs the media pipeline. The `llm` option sets the `model` AI param. It takes a model name, from which LiveWire removes any `provider/` prefix, or an LLM plugin object such as `new plugins.OpenAILLM({ model: 'gpt-4o' })`, whose `model` it uses:

<!-- snippet: no-compile before/after comparison; the "Before" half uses LiveKit plugin classes (DeepgramSTT/ElevenLabsTTS/SileroVAD/OpenAILLM) from external packages and redeclares `session` -->
```typescript
// Before (LiveKit)
const session = new AgentSession({
  stt: new DeepgramSTT(),
  tts: new ElevenLabsTTS(),
  vad: SileroVAD.load(),
  llm: new OpenAILLM({ model: 'gpt-4o' }),
});

// After (LiveWire)
const session = new AgentSession({
  stt: 'deepgram', // ignored; the platform handles STT
  tts: 'elevenlabs', // ignored; the platform handles TTS
  vad: plugins.SileroVAD.load(), // ignored; the platform handles VAD
  llm: 'openai/gpt-4o', // sets the model param to gpt-4o
});
```

## Step 4: Update Tool Definitions

LiveWire has the same `tool()` function. Its `parameters` must be a JSON Schema object:

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

LiveWire doesn't convert a Zod schema to JSON Schema: it sends `parameters` to the platform as given. Rewrite Zod parameter schemas as JSON Schema objects. Pass tools to the agent as an object keyed by name, as in LiveKit (`tools: { getWeather }`); each key becomes the tool's name.

## Step 5: Update the Entrypoint

The entry point keeps the LiveKit shape. `ctx.connect()` does nothing on SignalWire, and the `prewarm` callback still runs. Pass the definition to `runApp()`, which the complete example shows. When the entry function returns, `runApp()` serves the agent of the session it started:

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
  prewarm: (proc) => { /* runs; SignalWire has no worker processes to prewarm */ },
  entry: async (ctx) => {
    await ctx.connect(); // does nothing on SignalWire
    // ... create session, agent, tools ...
  },
});
```

## Step 6: Remove Infrastructure Configuration

A LiveKit agent often has configuration for these services:

- STT API keys and endpoints
- TTS API keys and endpoints
- VAD model paths
- LLM API keys
- WebRTC TURN/STUN servers
- Room service URLs

LiveWire doesn't use any of these settings, because SignalWire runs the media pipeline. You can remove them.

The agent's HTTP server reads its port and Basic Auth credentials from the environment:

```bash
# HTTP server port (optional; the default is 3000)
export PORT=3000

# Basic Auth credentials SignalWire uses to fetch the agent's SWML
export SWML_BASIC_AUTH_USER=your-username
export SWML_BASIC_AUTH_PASSWORD=a-long-random-password

# Only if your code also uses the REST client
export SIGNALWIRE_PROJECT_ID=your-project-id
export SIGNALWIRE_API_TOKEN=your-api-token
export SIGNALWIRE_SPACE=example.signalwire.com
```

## Step 7: Deploy

A LiveWire agent runs as a Node.js HTTP server, which `runApp()` starts. Compile the agent with the TypeScript compiler, then run the output:

```bash
# Build
npx tsc

# Run
node dist/my-agent.js
```

Then point a SignalWire phone number at the agent's URL, with the Basic Auth credentials, so the platform requests its SWML for each call.

## Complete Before/After Example

This section shows one agent written for LiveKit and the same agent converted to LiveWire.

### Before (LiveKit)

The LiveKit version imports the plugin packages and a Zod schema:

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

The LiveWire version imports from one module and passes the provider names as strings:

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

const agentDef = defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();
    const session = new AgentSession({
      stt: 'deepgram',
      tts: 'elevenlabs',
      vad: plugins.SileroVAD.load(),
      llm: 'openai/gpt-4o',
    });
    const agent = new Agent({
      instructions: 'You are a helpful assistant.',
      tools: { greet },
    });
    await session.start({ agent });
  },
});

runApp(agentDef);
```

The two versions differ in these ways:

1. One import path instead of several plugin packages
2. Provider names are strings instead of class instances
3. The tool's `parameters` is a JSON Schema object instead of a Zod schema
4. The definition is passed to `runApp()`, which serves the agent over HTTP
