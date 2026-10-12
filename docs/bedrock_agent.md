# BedrockAgent

`BedrockAgent` is an `AgentBase` subclass for Amazon Bedrock's voice-to-voice model. It keeps the standard agent features: prompts, skills, tools, DataMap tools, post-prompt and dynamic configuration. Its SWML uses the `amazon_bedrock` verb in place of the `ai` verb.

## Contents

The guide has these sections:

- [Create a BedrockAgent](#create-a-bedrockagent)
- [Constructor options](#constructor-options)
- [Voices](#voices)
- [Inference settings](#inference-settings)
- [Methods that behave differently](#methods-that-behave-differently)
- [What the agent renders](#what-the-agent-renders)
- [What the amazon_bedrock verb leaves out](#what-the-amazon_bedrock-verb-leaves-out)
- [Test with swaig-test](#test-with-swaig-test)
- [Complete example](#complete-example)
- [Deployment](#deployment)
- [Migrate from AgentBase](#migrate-from-agentbase)
- [Troubleshooting](#troubleshooting)
- [Related documentation](#related-documentation)

## Create a BedrockAgent

`BedrockAgent` and the `createBedrockAgent()` factory are exported from the package root. Construct the agent with a configuration object, then serve it the way you serve any agent:

```typescript
import { BedrockAgent } from '@signalwire/sdk';

const agent = new BedrockAgent({
  name: 'my_bedrock_agent',
  systemPrompt: 'You are a helpful assistant.',
  voiceId: 'tiffany',
  temperature: 0.7,
});

await agent.serve();
```

`createBedrockAgent(config)` takes the same `BedrockAgentConfig` and returns `new BedrockAgent(config)`. The default export of the module is the class itself.

Tools, skills and prompt sections work as they do on `AgentBase`. This agent adds a skill and a tool:

```typescript
import { BedrockAgent, DateTimeSkill, FunctionResult } from '@signalwire/sdk';

const agent = new BedrockAgent({ name: 'calculator', voiceId: 'matthew' });

agent.promptAddSection('Role', { body: 'You answer arithmetic questions.' });
await agent.addSkill(new DateTimeSkill());

agent.defineTool({
  name: 'calculate_sum',
  description: 'Add two numbers together',
  parameters: {
    a: { type: 'integer', description: 'The first number' },
    b: { type: 'integer', description: 'The second number' },
  },
  required: ['a', 'b'],
  handler: (args) => new FunctionResult(`The sum is ${args.a + args.b}.`),
});
```

`systemPrompt` sets the prompt as raw text. When a raw text prompt is set, the rendered prompt is that text alone: sections added with `promptAddSection()`, including the sections a skill adds, aren't rendered. That's `AgentBase` behavior, not specific to Bedrock. Use `promptAddSection()` in place of `systemPrompt` when you load skills that add prompt sections.

## Constructor options

The constructor takes one optional `BedrockAgentConfig` object. Every field is optional:

| Option | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | `'bedrock_agent'` | Agent name |
| `route` | `string` | `'/bedrock'` | HTTP route the agent serves |
| `systemPrompt` | `string` | none | Initial prompt, set with `setPromptText()` |
| `voiceId` | `string` | `'matthew'` | Bedrock voice; see [Voices](#voices) |
| `temperature` | `number \| string` | `0.7` | Sent as `prompt.temperature`; see [Inference settings](#inference-settings) |
| `topP` | `number \| string` | `0.9` | Sent as `prompt.top_p` |
| `maxTokens` | `number \| string` | `1024` | Sent as `prompt.max_tokens`; must be an integer. The platform's Bedrock session doesn't read it, and uses 1024 |
| `agentOptions` | `Partial<AgentOptions>` | none | Other `AgentBase` options, such as `basicAuth`, `port`, `swaigSecret` or `signingKey` |

`agentOptions` is spread after `name` and `route`, so a `name` or `route` inside it wins over the top-level fields.

## Voices

The SWML schema's `amazon_bedrock` prompt accepts five `voice_id` values:

- `tiffany`
- `matthew` (the schema's default, and the SDK's)
- `amy`
- `lupe`
- `carlos`

`BedrockAgent` doesn't check the value: `voiceId` and `setVoice()` accept any string and render it as `voice_id`. The schema rejects any other value, and the SDK doesn't validate the rendered verb against the schema.

## Inference settings

The `amazon_bedrock` prompt object carries the model settings. The SDK always sends `voice_id`, `temperature`, `top_p` and `max_tokens`, from the constructor options or the latest call to `setInferenceParams()`:

```typescript
import { BedrockAgent } from '@signalwire/sdk';

const agent = new BedrockAgent();

agent.setVoice('amy');
agent.setInferenceParams(0.5, 0.95, 2048); // temperature, topP, maxTokens
agent.setInferenceParams(undefined, undefined, 512); // change maxTokens only
```

An argument left `undefined` keeps its current value. Each value must be a number, and `max_tokens` an integer. A numeric string such as `'0.5'` is converted. `temperature` and `top_p` also accept a SWML variable reference such as `'${temperature}'`, which is sent as written. Anything else throws an `Error`, from the constructor, `setInferenceParams()`, `setLlmTemperature()` or `setPromptLlmParams()`, and a call that throws changes none of the settings:

```text
Error: BedrockAgent temperature must be a number, got "hot"
```

The platform's Bedrock session applies `temperature` from 0 to 2 and `top_p` from 0 to 1. It doesn't read `max_tokens`, and uses 1024. The schema allows `temperature` only up to 1.5 and `max_tokens` from 0 to 4096. The SDK doesn't clamp or check these ranges.

`setPromptLlmParams()` takes the settings by their SWML names. On a `BedrockAgent` it sorts them into two groups:

- `temperature`, `top_p` and `max_tokens` update the inference settings, as `setInferenceParams()` does, so a value that isn't a number throws.
- Any other key is left out, and the SDK logs a warning that names it. The platform's Bedrock session reads no other prompt setting, so this includes `confidence`, `presence_penalty` and `frequency_penalty`, which the schema's Bedrock prompt lists, and `barge_confidence`.

This call sets `max_tokens` and four settings the Bedrock session doesn't use:

```typescript
import { BedrockAgent } from '@signalwire/sdk';

const agent = new BedrockAgent({
  systemPrompt: 'You answer questions about order status.',
  voiceId: 'tiffany',
});

agent.setPromptLlmParams({
  max_tokens: 512,
  confidence: 0.7,
  presence_penalty: 0.2,
  frequency_penalty: 0.1,
  barge_confidence: 0.5,
});
```

The SDK logs this warning for the keys it leaves out:

```text
2026-09-29T22:06:32.030Z [WARN] [AgentBase] setPromptLlmParams(): the platform's Bedrock session doesn't use barge_confidence, confidence, frequency_penalty, presence_penalty, so they're ignored
```

The rendered prompt then carries the text, the voice and the inference settings:

```json
{
  "text": "You answer questions about order status.",
  "voice_id": "tiffany",
  "temperature": 0.7,
  "top_p": 0.9,
  "max_tokens": 512
}
```

## Methods that behave differently

Four `AgentBase` methods behave differently on a `BedrockAgent`:

| Method | On a `BedrockAgent` |
|---|---|
| `setLlmModel(model)` | Logs a warning and changes nothing. The Bedrock voice-to-voice model is fixed. |
| `setLlmTemperature(temperature)` | Calls `setInferenceParams(temperature)`. |
| `setPostPromptLlmParams(params)` | Logs a warning and changes nothing. |
| `setPromptLlmParams(params)` | Sorts the settings as described in [Inference settings](#inference-settings). |

The warning from `setPostPromptLlmParams()` says the Bedrock post-prompt uses a model the engine configures. The SWML schema's `amazon_bedrock` `post_prompt` does accept `temperature`, `top_p`, `max_tokens`, `confidence` and the penalties, but the platform's Bedrock post-prompt reads only its text, with its other settings fixed in the engine, so `BedrockAgent` doesn't send them. Set the post-prompt text with `setPostPrompt()` as usual.

`BedrockAgent` adds two methods of its own: `setVoice(voiceId)` and `setInferenceParams(temperature?, topP?, maxTokens?)`. Both return the agent, so calls chain.

## What the agent renders

`BedrockAgent` overrides `renderSwml()`. It renders the document as `AgentBase` does, then replaces the `ai` verb with an `amazon_bedrock` verb that carries six of its keys. It adds `voice_id` and the inference settings to the prompt object, and keeps only `text` or `pom` from the `ai` prompt, since the platform's Bedrock session reads no other prompt setting.

Run `swaig-test` with `--dump-swml` to see the document an agent renders:

```bash
npx tsx src/cli/swaig-test.ts bedrock-support.ts --dump-swml
```

This is the output for the agent in [Complete example](#complete-example), with basic auth set to `user:pass`, the token shortened and three of the four functions removed:

```json
{
  "version": "1.0.0",
  "sections": {
    "main": [
      {
        "answer": {}
      },
      {
        "amazon_bedrock": {
          "prompt": {
            "text": "You help callers check the status of their orders.",
            "voice_id": "tiffany",
            "temperature": 0.5,
            "top_p": 0.9,
            "max_tokens": 512
          },
          "SWAIG": {
            "functions": [
              {
                "function": "check_order_status",
                "description": "Look up the status of an order by its ID",
                "parameters": {
                  "type": "object",
                  "properties": {
                    "order_id": {
                      "type": "string",
                      "description": "The order ID to look up"
                    }
                  },
                  "required": [
                    "order_id"
                  ]
                },
                "web_hook_url": "http://user:pass@localhost:3000/support/swaig?__token=..."
              }
            ],
            "defaults": {
              "web_hook_url": "http://user:pass@localhost:3000/support/swaig"
            }
          },
          "params": {},
          "global_data": {}
        }
      }
    ]
  }
}
```

The `amazon_bedrock` verb carries these keys:

| Key | Content |
|---|---|
| `prompt` | `text` or `pom`, `voice_id`, `temperature`, `top_p` and `max_tokens`. The platform's Bedrock session reads all but `max_tokens` |
| `SWAIG` | `functions`, `defaults` and any other SWAIG keys the agent built |
| `params` | The values from `setParams()`, such as `attention_timeout` or `inactivity_timeout` |
| `global_data` | The agent's global data |
| `post_prompt` | Present when a post-prompt is set |
| `post_prompt_url` | Present when a post-prompt is set |

`SWAIG`, `params` and `global_data` are always present, as empty objects when there's nothing to send. `post_prompt` and `post_prompt_url` appear only when the agent has a post-prompt.

## What the amazon_bedrock verb leaves out

`BedrockAgent` copies only the six keys in the preceding table from the `ai` verb, and only the keys the Bedrock prompt object defines from the `ai` prompt. Everything else that `AgentBase` puts on the `ai` verb or its prompt is left out of the SWML:

| Configured with | Key left out |
|---|---|
| `addHint()`, `addHints()`, `addPatternHint()`, and skills that add hints | `hints` |
| `addLanguage()` | `languages` |
| `addPronunciation()`, `setPronunciations()` | `pronounce` |
| `enableDebugEvents()` | `debug_webhook_url`, `debug_webhook_level` |
| `setMultilingual()` | `multilingual` |
| `defineContexts()` | `contexts`, in the prompt |

The SWML schema's `amazon_bedrock` verb has none of these keys, and its `prompt` object doesn't define `contexts`, so contexts and steps don't work with a `BedrockAgent`.

The agent logs one warning for each key it leaves out, the first time it renders SWML without it. Later renders, including the per-request copies that serve calls, don't repeat it. An agent with hints and contexts logs these two warnings once:

```text
2026-09-29T21:49:19.732Z [WARN] [AgentBase] BedrockAgent: the amazon_bedrock verb has no hints, so the agent's speech hints (addHint(), addHints(), addPatternHint() and skills' hints) are left out of the SWML
2026-09-29T21:49:19.732Z [WARN] [AgentBase] BedrockAgent: Bedrock's prompt has no contexts, so the agent's contexts and steps (defineContexts()) are left out of the SWML
```

`params` is passed through as it is. The schema's `amazon_bedrock` `params` lists `attention_timeout`, `inactivity_timeout`, `hard_stop_time`, `hard_stop_prompt` and the three video file URLs.

## Test with swaig-test

`swaig-test` loads a `BedrockAgent` file as it loads any agent file. Put options before `--exec`; the flags after `--exec <function>` are the function's arguments.

This command lists the agent's tools:

```bash
npx tsx src/cli/swaig-test.ts bedrock-support.ts --list-tools
```

The output lists the two `DateTimeSkill` tools and the two tools the file defines:

```text
Available SWAIG functions:
  get_current_time - Get the current time, optionally in a specific timezone (LOCAL webhook)
    Parameters:
      timezone (string): Timezone name (e.g., 'America/New_York', 'Europe/London'). Defaults to UTC.
  get_current_date - Get the current date (LOCAL webhook)
    Parameters:
      timezone (string): Timezone name for the date. Defaults to UTC.
  check_order_status - Look up the status of an order by its ID (LOCAL webhook)
    Parameters:
      order_id (string) (required): The order ID to look up
  transfer_to_support - Transfer the caller to the support team (LOCAL webhook)
    Parameters: None
```

This command runs one tool with an argument:

```bash
npx tsx src/cli/swaig-test.ts bedrock-support.ts --exec check_order_status --order_id A-1001
```

The handler's result is printed:

```text
RESULT:
Response: Order A-1001: shipped, arriving Thursday.
```

In an installed package, the same commands run as `npx swaig-test`. For more information, see the [CLI guide](cli-guide.md).

## Complete example

This file, `bedrock-support.ts`, is the agent the earlier outputs came from. It sets a voice and inference settings, loads a skill, and defines two tools:

```typescript
import { BedrockAgent, DateTimeSkill, FunctionResult } from '@signalwire/sdk';

export const agent = new BedrockAgent({
  name: 'order_support',
  route: '/support',
  systemPrompt: 'You help callers check the status of their orders.',
  voiceId: 'tiffany',
  temperature: 0.5,
  maxTokens: 512,
});

await agent.addSkill(new DateTimeSkill());

agent.defineTool({
  name: 'check_order_status',
  description: 'Look up the status of an order by its ID',
  parameters: {
    order_id: { type: 'string', description: 'The order ID to look up' },
  },
  required: ['order_id'],
  handler: (args) => {
    // Replace with a lookup in your order system.
    return new FunctionResult(`Order ${args.order_id}: shipped, arriving Thursday.`);
  },
});

agent.defineTool({
  name: 'transfer_to_support',
  description: 'Transfer the caller to the support team',
  parameters: {},
  handler: () => new FunctionResult('Transferring the caller to support.').connect('+15551234567'),
});

await agent.serve();
```

The file exports `agent` so that `swaig-test` can find it. `swaig-test` sets `SWAIG_CLI_MODE`, and `serve()` returns without starting a server in that mode. Because `systemPrompt` is raw text, the `DateTimeSkill` prompt section isn't rendered; its tools are.

## Deployment

A `BedrockAgent` deploys the same way as any agent:

- **Basic auth.** The agent uses `SWML_BASIC_AUTH_USER` and `SWML_BASIC_AUTH_PASSWORD`, or `agentOptions.basicAuth`. Without a password, the SDK generates a random one for the process and logs a warning. The username is then `SWML_BASIC_AUTH_USER`, or the agent's name.
- **Port.** The agent listens on `PORT`, or 3000. Pass `{ port }` to `serve()` or `agentOptions.port` to change it.
- **Tool tokens.** Tools are secure by default, so each webhook URL carries a per-call `__token`. Set `swaigSecret` or `SIGNALWIRE_SWAIG_SECRET` to the same value on every replica, or tokens minted by one process fail on another.
- **Webhook signatures.** Set `signingKey` or `SIGNALWIRE_SIGNING_KEY` to refuse unsigned POST requests.
- **Skills.** Set the environment variables the skills you load need, such as API keys.

For more information, see the [security guide](security.md) and [configuration reference](configuration.md).

## Migrate from AgentBase

Most agent code runs unchanged on a `BedrockAgent`. This is the change to the constructor:

```typescript
import { AgentBase, BedrockAgent } from '@signalwire/sdk';

// Before
const before = new AgentBase({ name: 'my_agent' });

// After
const after = new BedrockAgent({ name: 'my_agent', voiceId: 'matthew' });
```

`AgentBase` takes its options directly, and `BedrockAgent` takes other `AgentBase` options under `agentOptions`. `BedrockAgent` defaults to the `/bedrock` route, not `/`. After the change, review these points:

- Replace `setLlmModel()` calls; they have no effect.
- Move model settings to `setInferenceParams()` or `setPromptLlmParams()`.
- Choose one of the five Bedrock voices.
- Replace hints, languages, pronunciation rules, multilingual settings and contexts, which the `amazon_bedrock` verb doesn't carry. See [What the amazon_bedrock verb leaves out](#what-the-amazon_bedrock-verb-leaves-out).

## Troubleshooting

These problems come up with a `BedrockAgent`:

- **The voice doesn't change.** Check that the value is one of the [five voices](#voices). The SDK sends any string.
- **A setting doesn't appear in the prompt.** Only `temperature`, `top_p` and `max_tokens` are sent, and the platform's Bedrock session doesn't read `max_tokens` (it uses 1024). Look for the `setPromptLlmParams()` warning in the log.
- **Prompt sections are missing.** `systemPrompt` or `setPromptText()` replaces the POM prompt. Use `promptAddSection()` alone for a structured prompt.
- **Steps don't run.** The Bedrock prompt doesn't define `contexts`, so the SDK leaves them out and logs a warning.
- **The constructor or `setInferenceParams()` throws.** `temperature`, `top_p` and `max_tokens` must be numbers, or numeric strings. See [Inference settings](#inference-settings).
- **The agent doesn't answer at `/`.** Its route is `/bedrock` unless you set `route`.

Set `SIGNALWIRE_LOG_LEVEL=debug` to log the voice and inference changes as they're made.

## Related documentation

For more information, see these documents:

- [Agent guide](agent-guide.md): prompts, tools, skills and the other `AgentBase` features a `BedrockAgent` inherits
- [Skills system](skills-system.md): loading and configuring skills
- [SWAIG reference](swaig-reference.md): tool definitions and `FunctionResult` actions
- [DataMap guide](datamap-guide.md): tools that run on the platform
