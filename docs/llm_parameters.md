# LLM Parameters Guide

This guide covers the LLM parameters of a SignalWire AI agent's main prompt and post-prompt, and how to set them with the TypeScript SDK.

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module (top-level await)
declare global {
  const agent: import('@signalwire/sdk').AgentBase;
  const AgentBase: typeof import('@signalwire/sdk').AgentBase; // used with `extends`
}
```

## Overview

The SDK has one method for the main prompt's LLM parameters and one for the post-prompt's. The SDK writes the parameters into the SWML `prompt` and `post_prompt` objects, next to the prompt text.

**Important:** The SDK doesn't validate these parameters. It passes every key and value through to SignalWire unchanged, so a misspelled key or an out-of-range value reaches the platform as written.

## Available Methods

### `setPromptLlmParams(params)`

`setPromptLlmParams()` merges parameters into the main prompt:

```typescript
agent.setPromptLlmParams({
  temperature: 0.7,
  top_p: 0.9,
  presence_penalty: 0.0,
  frequency_penalty: 0.0,
});
```

### `setPostPromptLlmParams(params)`

`setPostPromptLlmParams()` merges parameters into the post-prompt, which produces the call summary:

```typescript
agent.setPostPromptLlmParams({
  temperature: 0.3,
  top_p: 0.95,
  presence_penalty: 0.0,
  frequency_penalty: 0.0,
});
```

Both methods merge into the parameters already set, so you can call them more than once. A later value for the same key replaces the earlier one.

The prompt objects are separate from the `ai` verb's `params`, which `setParam()` and `setParams()` set. `temperature` and the other keys in this guide belong in the prompt objects.

## Parameter Reference

The SWML schema defines these parameters for both `prompt` and `post_prompt`. The ranges and defaults come from the schema bundled with the SDK (`src/schema.json`):

| Parameter | Type | Range | Default | Description |
|---|---|---|---|---|
| `temperature` | number | 0.0 to 1.5 | 1.0 | Randomness. Values closer to 0 make the output less random. |
| `top_p` | number | 0.0 to 1.0 | 1.0 | Nucleus sampling, an alternative to `temperature`. Values closer to 0 make the output less random. |
| `presence_penalty` | number | -2.0 to 2.0 | 0 | Aversion to staying on a topic. Positive values make new topics more likely. |
| `frequency_penalty` | number | -2.0 to 2.0 | 0 | Aversion to repeating lines. Positive values make verbatim repetition less likely. |
| `confidence` | number | 0.0 to 1.0 | 0.6 | Threshold for the speech-detect event at the end of an utterance. Lower values shorten the pause after the caller speaks, and can add false positives. |
| `max_tokens` | integer | 0 to 4096 | 256 | Limit on the tokens the model may generate for a response. |

The defaults are the platform's. The SDK sends a parameter only when you set it.

### temperature

`temperature` controls how random the responses are. These ranges are guidance, not rules:

- **Lower values (for example, 0.0 to 0.3)**: more deterministic and consistent responses
- **Middle values (for example, 0.4 to 0.7)**: a balance of variety and consistency
- **Higher values (for example, 0.8 and up)**: more varied and less predictable responses

### top_p

`top_p` limits token selection to the most likely tokens whose probabilities add up to the value:

- **Lower values (for example, 0.1 to 0.5)**: only the most likely tokens
- **Middle values (for example, 0.6 to 0.9)**: a balanced selection
- **Higher values (for example, 0.95 to 1.0)**: a wider range of tokens

### presence_penalty

`presence_penalty` penalizes tokens that already appear in the conversation:

- **Negative values**: encourage returning to the same topics
- **Zero**: no penalty
- **Positive values**: discourage repetition, and encourage new topics

### frequency_penalty

`frequency_penalty` penalizes tokens by how often they appear in the conversation:

- **Negative values**: encourage repeating the same words
- **Zero**: no penalty
- **Positive values**: discourage word repetition

### barge_confidence

`barge_confidence` is described elsewhere as an ASR confidence threshold for interrupting the AI while it speaks. It isn't in the bundled SWML schema, for the prompt objects or for `params`, so this guide gives no range or default for it. The SDK passes it through if you set it. The schema's barge settings in `params` include `barge_match_string`, `barge_min_words` and `enable_barge`.

## Use Case Examples

### Customer Service Agent

A low temperature and a small penalty keep the responses consistent:

```typescript
import { AgentBase } from '@signalwire/sdk';

class CustomerServiceAgent extends AgentBase {
  constructor() {
    super({ name: 'customer-service', route: '/support' });

    this.promptAddSection('Role', {
      body: 'You are a professional customer service representative.',
    });

    // Consistent, helpful responses
    this.setPromptLlmParams({
      temperature: 0.3, // Low randomness for consistency
      top_p: 0.9, // Focused token selection
      presence_penalty: 0.1, // Slight penalty to avoid repetition
      frequency_penalty: 0.1, // Encourage varied language
    });
  }
}
```

### Creative Writing Assistant

A higher temperature and a wider `top_p` suit an agent that should vary its answers:

```typescript
class CreativeWritingAgent extends AgentBase {
  constructor() {
    super({ name: 'creative-writer', route: '/writer' });

    this.promptAddSection('Role', { body: 'You are a creative writing assistant.' });

    // Varied responses
    this.setPromptLlmParams({
      temperature: 0.8, // Higher randomness for variety
      top_p: 0.95, // Wide token selection
      presence_penalty: -0.1, // Allow topic revisiting
      frequency_penalty: 0.3, // Encourage vocabulary diversity
    });
  }
}
```

### Technical Documentation Bot

A low temperature keeps technical answers precise, and the post-prompt uses a lower one still:

```typescript
class TechnicalDocsAgent extends AgentBase {
  constructor() {
    super({ name: 'tech-docs', route: '/docs' });

    this.promptAddSection('Role', { body: 'You are a technical documentation assistant.' });

    // Precise responses
    this.setPromptLlmParams({
      temperature: 0.2, // Low randomness
      top_p: 0.8, // More focused token selection
      presence_penalty: 0.0, // Neutral on repetition
      frequency_penalty: 0.2, // Some vocabulary variety
      max_tokens: 400, // Room for longer explanations
    });

    // Even more focused for summaries
    this.setPostPromptLlmParams({ temperature: 0.1 });
  }
}
```

### Legal Information Bot

A legal information agent repeats legal terms on purpose, so it sets no penalties:

```typescript
class LegalAdvisorAgent extends AgentBase {
  constructor() {
    super({ name: 'legal-advisor', route: '/legal' });

    this.promptAddSection('Role', { body: 'You are a legal information assistant.' });
    this.promptAddSection('Disclaimer', {
      body: 'Always remind users to consult a real attorney.',
    });

    // Cautious, precise responses
    this.setPromptLlmParams({
      temperature: 0.2, // Consistent
      top_p: 0.85, // Focused selection
      presence_penalty: 0.0, // Allow legal term repetition
      frequency_penalty: 0.0, // Legal language often repeats
    });
  }
}
```

## Best Practices

### 1. Start with the Platform Defaults

Set nothing at first, and adjust based on the behavior you observe.

### 2. Change One Thing at a Time

Make small changes and test each one, so you know which change had which effect.

### 3. Match the Use Case

These starting points are guidance, not measured values:

- **Customer service**: low temperature (0.2 to 0.4)
- **Creative tasks**: higher temperature (0.7 to 0.9)
- **Technical or legal**: the lowest temperatures (0.1 to 0.3)
- **General assistant**: middle temperature (0.5 to 0.7)

### 4. Lower the Post-Prompt Temperature

A post-prompt usually produces a structured summary, so a lower temperature than the main prompt's keeps it consistent.

## Parameter Interactions

### Temperature and top_p

Both parameters control randomness, and they combine:

- Low temperature and low `top_p`: the most focused responses
- High temperature and high `top_p`: the most variety
- Low temperature and high `top_p`: consistent, with some alternatives available
- High temperature and low `top_p`: varied, within a narrow token set

### Penalty Parameters

The two penalties can be used together:

- Both positive: stronger push toward variety
- Both negative: stronger push toward repetition
- Mixed: finer control over which kind of repetition is allowed

## Troubleshooting

### The AI Repeats Itself

These changes reduce repetition:

- Increase `presence_penalty` (try 0.3 to 0.6)
- Increase `frequency_penalty` (try 0.3 to 0.6)
- Increase `temperature` slightly

### The AI Is Too Random or Inconsistent

These changes make the output steadier:

- Decrease `temperature` (try 0.2 to 0.4)
- Decrease `top_p` (try 0.7 to 0.85)

### Interruptions

Interruption behavior is set in the `ai` verb's `params`, not in the prompt objects. See `barge_match_string`, `barge_min_words`, `enable_barge` and `interrupt_on_noise` in the SWML schema.

## Parameter Behavior

**No defaults from the SDK:** The SDK sends no LLM parameters unless you set them with `setPromptLlmParams()` or `setPostPromptLlmParams()`. Without them, the platform uses its own defaults.

**No validation in the SDK:** The SDK accepts any key and passes it through unchanged. A parameter the platform adds later works without an SDK update, and a typo isn't caught.

**Partial configuration:** You can set only the parameters you want to change:

```typescript
// Only set temperature; the platform handles the rest
agent.setPromptLlmParams({ temperature: 0.7 });

// Or set several specific parameters
agent.setPromptLlmParams({ temperature: 0.5, top_p: 0.9 });
```

## Related

For the rest of `AgentBase`'s configuration, including `setParams()` for the `ai` verb's other parameters, see the [Agent Guide](agent-guide.md).
