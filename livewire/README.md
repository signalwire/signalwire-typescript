# LiveWire: LiveKit-Compatible Agents on SignalWire

`runApp()` prints this banner when a LiveWire app starts:

```text
    __    _            _       ___
   / /   (_)   _____  | |     / (_)_______
  / /   / / | / / _ \ | | /| / / / ___/ _ \
 / /___/ /| |/ /  __/ | |/ |/ / / /  /  __/
/_____/_/ |___/\___/  |__/|__/_/_/   \___/

 LiveKit-compatible agents powered by SignalWire
```

LiveWire lets you run agents written against the LiveKit agents API (`@livekit/agents`) on SignalWire. It provides the same class and function names, so you change the import path and keep your agent code. SignalWire runs speech recognition, text-to-speech, voice activity detection and the LLM. Under the hood, each LiveWire session builds a SignalWire `AgentBase`.

## Quick Start

This example defines a weather tool and an agent, then starts the app with `runApp()`:

<!-- snippet: no-run imports the @signalwire/sdk/livewire subpath, which resolves only from the built+installed package, not from the source tree -->
```typescript
import {
  Agent, AgentSession, tool,
  defineAgent, JobContext, runApp,
} from '@signalwire/sdk/livewire';

const getWeather = tool({
  description: 'Get weather for a location',
  parameters: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'City name' },
    },
    required: ['location'],
  },
  execute: (params: { location: string }) => {
    return `The weather in ${params.location} is sunny, 72F with clear skies.`;
  },
});

const agentDef = defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();

    const session = new AgentSession({
      stt: 'deepgram',
      llm: 'openai/gpt-4o',
      tts: 'elevenlabs',
    });

    const agent = new Agent({
      instructions: 'You are a helpful weather assistant.',
      tools: [{ ...getWeather, name: 'get_weather' }],
    });

    await session.start({ agent });
    session.generateReply({ instructions: 'Greet the user and ask how you can help.' });
  },
});

runApp(agentDef);
```

`tool()` returns a tool with an empty name, so you set `name` when you add it to the agent's `tools` array. The `@signalwire/sdk/livewire` subpath exports the same names as the `livewire` namespace of `@signalwire/sdk`.

## Why LiveWire

A LiveKit agent configures its own STT, TTS, VAD and LLM providers, and each is a service you run or pay for separately. LiveWire keeps the same developer-facing API, and SignalWire's control plane runs the media pipeline:

- **STT**: speech recognition runs on SignalWire.
- **TTS**: text-to-speech runs on SignalWire.
- **VAD**: voice activity detection needs no configuration.
- **LLM**: the platform runs the model; the `llm` option picks it.
- **Call control**: barge-in, hold, transfer and conferencing are platform features.

## Feature Mapping

The table maps each LiveKit concept to what LiveWire does with it:

| LiveKit Concept | LiveWire | Notes |
|---|---|---|
| `voice.Agent` | `Agent` | `instructions` becomes the prompt; `tools` become SWAIG functions |
| `voice.AgentSession` | `AgentSession` | `start()` builds a SignalWire `AgentBase` |
| `llm.tool()` | `tool()` | Registered as a SWAIG function when the session starts |
| `llm.handoff()` | `handoff()` | Returns an `AgentHandoff`; LiveWire doesn't act on it |
| `RunContext` | `RunContext` | Passed to tool handlers as `context.ctx` |
| `defineAgent()` | `defineAgent()` | Returns the `{ entry, prewarm }` object unchanged |
| `cli.runApp()` | `runApp()` | Prints a banner and a tip, runs prewarm, then calls the entry function |
| `stt: 'deepgram'` | Ignored (logged once) | The platform handles STT |
| `tts: 'elevenlabs'` | Ignored (logged once) | The platform handles TTS |
| `vad: plugins.SileroVAD.load()` | Ignored (logged once) | The platform handles VAD |
| `llm: 'openai/gpt-4o'` | Sets the `model` AI param | The `openai/` prefix is removed |
| `allowInterruptions: false` | Sets `barge_confidence` to 1.0 | |
| `minEndpointingDelay` / `maxEndpointingDelay` | Set `end_of_speech_timeout` / `attention_timeout` | Seconds, converted to milliseconds; defaults 0.5 and 3.0 |
| `AgentSession.interrupt()` | Does nothing (logged once) | The platform handles barge-in |
| `JobContext.connect()` | Does nothing (logged once) | The platform connects when it requests the agent's SWML |
| `prewarm` | Runs (logged once) | There are no worker processes to prewarm |
| `StopResponse`, `ToolError` | Exported | Thrown from a tool, each gets the SDK's generic tool error response |

## What LiveWire Ignores

Several LiveKit options have no effect on SignalWire, because the platform handles what they configure:

- **STT, TTS and VAD providers**: SignalWire's control plane runs the speech pipeline. `stt: 'deepgram'` is accepted and ignored.
- **`JobContext.connect()`**: SignalWire connects when the platform requests the agent's SWML. There's no separate connection step.
- **Worker prewarming**: SignalWire manages the media infrastructure. The `prewarm` callback still runs.
- **`interrupt()`**: SignalWire handles barge-in, when the caller speaks over the agent.

Each ignored option logs a message to stderr the first time it's used, so you can see which settings had no effect.

Some LiveKit behaviors aren't implemented. LiveWire doesn't call the `onEnter()`, `onExit()` or `onUserTurnCompleted()` hooks. `session.history` stays empty. `session.say()` and `generateReply()` add text to the prompt; they don't make the agent speak it word for word. `tool()` doesn't convert a Zod schema, so pass JSON Schema as `parameters`.

## Plugin Stubs

LiveWire includes stub classes for common LiveKit plugin providers:

- `plugins.DeepgramSTT`: STT stub
- `plugins.ElevenLabsTTS`: TTS stub
- `plugins.CartesiaTTS`: TTS stub
- `plugins.OpenAILLM`: LLM stub
- `plugins.SileroVAD`: VAD stub

These exist so that LiveKit code that creates provider instances still compiles. They have no effect at runtime. To choose the model, pass its name as a string in the `llm` option, not a `plugins.OpenAILLM` instance.

## Inference Stubs

LiveWire also includes stubs for LiveKit's `inference` classes. Each one stores the model name you pass and runs nothing:

- `inference.STT`: STT model stub
- `inference.LLM`: LLM model stub
- `inference.TTS`: TTS model stub

## Documentation

The [Migration Guide](docs/migration-guide.md) moves a LiveKit agent to LiveWire step by step. The implementation is in `src/livewire/index.ts` in the SDK repository.

## Examples

These examples are in the repository:

- [livewire-basic-agent.ts](examples/livewire-basic-agent.ts): an agent with a single tool
- [livewire-multi-tool.ts](examples/livewire-multi-tool.ts): an agent with several function tools and `RunContext`
- [livewire-handoff.ts](examples/livewire-handoff.ts): several agents and handoff tools

## Environment Variables

A LiveWire session builds a SignalWire `AgentBase` named `LiveWireAgent`, with the route `/`. It reads the same environment variables as any SignalWire agent. These are the common ones:

| Variable | Description |
|----------|-------------|
| `SWML_BASIC_AUTH_USER` | HTTP Basic Auth username. Defaults to the agent name, `LiveWireAgent`. |
| `SWML_BASIC_AUTH_PASSWORD` | HTTP Basic Auth password. If unset, the SDK generates a random password for the process and logs a warning. |
| `PORT` | HTTP server port (default: 3000) |
