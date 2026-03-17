# LiveWire -- LiveKit-Compatible Agents on SignalWire

```
    __    _            _       ___
   / /   (_)   _____  | |     / (_)_______
  / /   / / | / / _ \ | | /| / / / ___/ _ \
 / /___/ /| |/ /  __/ | |/ |/ / / /  /  __/
/_____/_/ |___/\___/  |__/|__/_/_/   \___/

 LiveKit-compatible agents powered by SignalWire
```

LiveWire lets you run LiveKit-style voice agents on SignalWire's infrastructure with zero changes to your application logic. Just swap the import path -- SignalWire handles STT, TTS, VAD, LLM orchestration, and call control at scale.

## Quick Start

```typescript
import {
  Agent, AgentSession, tool, RunContext,
  defineAgent, JobContext, runApp,
} from 'signalwire-agents/livewire';

const getWeather = tool({
  description: 'Get weather for a location',
  parameters: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'City name' },
    },
  },
  execute: (params: { location: string }) => {
    return `The weather in ${params.location} is sunny, 72F with clear skies.`;
  },
});

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();

    const session = new AgentSession({
      stt: 'deepgram',
      llm: 'openai/gpt-4',
      tts: 'elevenlabs',
    });

    const agent = new Agent({
      instructions: 'You are a helpful weather assistant.',
      tools: { get_weather: { ...getWeather, name: 'get_weather' } },
    });

    await session.start({ agent });
    session.generateReply({ instructions: 'Greet the user and ask how you can help.' });
  },
});
```

## Why LiveWire?

LiveKit agents require you to manage your own STT, TTS, VAD, and LLM infrastructure. Each component is a separate service you configure, deploy, and scale independently. LiveWire provides the same developer-facing API, but SignalWire's control plane handles the entire media pipeline:

- **STT** -- speech recognition runs in SignalWire's cloud at scale
- **TTS** -- text-to-speech runs in SignalWire's cloud at scale
- **VAD** -- voice activity detection is automatic, no configuration needed
- **LLM** -- model orchestration is handled by the platform
- **Call control** -- barge-in, hold, transfer, conferencing all built in

You write the same agent code. SignalWire runs it.

## Feature Mapping

| LiveKit Concept | SignalWire Equivalent | Notes |
|---|---|---|
| `voice.Agent` | `Agent` | Identical API |
| `voice.AgentSession` | `AgentSession` | Maps to `AgentBase` internally |
| `llm.tool()` | `tool()` | Registers SWAIG functions |
| `llm.handoff()` | `handoff()` | Multi-agent handoff |
| `RunContext` | `RunContext` | Available in tool handlers |
| `defineAgent()` | `defineAgent()` | Wraps entry/prewarm |
| `cli.runApp()` | `runApp()` | Starts the agent |
| `stt: 'deepgram'` | Noop (logged once) | Platform handles STT |
| `tts: 'elevenlabs'` | Noop (logged once) | Platform handles TTS |
| `vad: silero` | Noop (logged once) | Platform handles VAD |
| `llm: 'openai/gpt-4'` | Maps to model param | Model selection works |
| `AgentSession.interrupt()` | Noop (logged once) | Barge-in is automatic |
| `JobContext.connect()` | Noop (logged once) | Platform connects automatically |
| `prewarm` | Noop (logged once) | No warm pools needed |
| `AgentHandoff` | `AgentHandoff` | Multi-agent handoff |
| `StopResponse` | `StopResponse` | Suppress LLM reply |

## What's Noop'd and Why

Several LiveKit concepts are no-ops on SignalWire because the platform handles them automatically:

- **STT/TTS/VAD providers**: SignalWire's control plane runs the entire speech pipeline. Specifying `stt: 'deepgram'` is accepted but ignored -- the platform selects optimal providers automatically.
- **JobContext.connect()**: SignalWire agents connect when the platform invokes the SWML endpoint. There is no manual connection step.
- **prewarm / warm pools**: SignalWire manages media infrastructure scaling. No process prewarming is needed.
- **interrupt()**: Barge-in (caller interrupting the agent) is automatic on SignalWire.

Each noop logs an informational message once so you know it was received but is not needed.

## Plugin Stubs

LiveWire includes stub types for common LiveKit plugin providers:

- `plugins.DeepgramSTT` -- STT stub
- `plugins.ElevenLabsTTS` -- TTS stub
- `plugins.CartesiaTTS` -- TTS stub
- `plugins.OpenAILLM` -- LLM stub
- `plugins.SileroVAD` -- VAD stub

These exist so that LiveKit code that creates provider instances continues to compile. They have no effect at runtime.

## Inference Stubs

- `inference.STT` -- STT model stub
- `inference.LLM` -- LLM model stub
- `inference.TTS` -- TTS model stub

## Documentation

- [Migration Guide](docs/migration-guide.md) -- step-by-step guide for migrating a LiveKit agent to LiveWire
- [LiveWire source code](../src/livewire/) -- the full TypeScript implementation

## Examples

- [livewire-basic-agent.ts](examples/livewire-basic-agent.ts) -- simple agent with a single tool
- [livewire-multi-tool.ts](examples/livewire-multi-tool.ts) -- agent with multiple function tools and RunContext
- [livewire-handoff.ts](examples/livewire-handoff.ts) -- multi-agent with AgentHandoff

## Environment Variables

LiveWire agents use the same environment variables as standard SignalWire agents:

| Variable | Description |
|----------|-------------|
| `SIGNALWIRE_PROJECT_ID` | Project ID (if using RELAY features) |
| `SIGNALWIRE_API_TOKEN` | API token (if using RELAY features) |
| `SWML_BASIC_AUTH_USER` | HTTP Basic Auth username (auto-generated if not set) |
| `SWML_BASIC_AUTH_PASSWORD` | HTTP Basic Auth password (auto-generated if not set) |
| `PORT` | HTTP server port (default: 3000) |
