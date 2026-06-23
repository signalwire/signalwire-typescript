# LLM Parameters Guide

This guide explains how to customize Language Model (LLM) parameters in SignalWire AI Agents to fine-tune the AI's behavior for your specific use case.

## Overview

The SignalWire AI Agents TypeScript SDK provides methods to customize LLM parameters for both the main prompt and the post-prompt, giving precise control over the AI's response characteristics.

**Important:** The SDK passes parameters through to the SignalWire server without validation. Model-specific parameters are validated and handled by the server based on the target model's capabilities. Parameters that are invalid for the selected model are handled or ignored by the server.

## Available Methods

### `setPromptLlmParams(params)`

Merges LLM parameters into the main agent prompt. Accepts an object of parameters passed
through to the server.

```typescript
agent.setPromptLlmParams({
  temperature: 0.7,
  top_p: 0.9,
  barge_confidence: 0.6,
  presence_penalty: 0.0,
  frequency_penalty: 0.0,
});
```

### `setPostPromptLlmParams(params)`

Merges LLM parameters into the post-prompt (conversation summary).

```typescript
agent.setPostPromptLlmParams({
  temperature: 0.3,
  top_p: 0.95,
  presence_penalty: 0.0,
  frequency_penalty: 0.0,
});
```

Note: `barge_confidence` does not apply to the post-prompt, since interruption doesn't apply
to summaries.

Both methods merge into the existing parameters, so you can call them more than once to
build up the configuration incrementally.

## Common Parameter Descriptions

These are commonly used parameters, but any parameter accepted by your model can be used. The actual ranges and defaults are model-specific and handled by the server. SWML output keys are `snake_case` (the platform format).

### temperature
Controls the randomness of the AI's responses.
- **Lower values (e.g., 0.0-0.3)**: More deterministic, focused, and consistent responses
- **Medium values (e.g., 0.4-0.7)**: Balanced creativity and consistency
- **Higher values (e.g., 0.8+)**: More creative, diverse, and unpredictable responses

### top_p
Nucleus sampling parameter that controls the cumulative probability of token selection.
- **Lower values (e.g., 0.1-0.5)**: Only considers the most likely tokens
- **Medium values (e.g., 0.6-0.9)**: Balanced token selection
- **Higher values (e.g., 0.95-1.0)**: Considers a wider range of tokens

### barge_confidence
ASR (Automatic Speech Recognition) confidence threshold to interrupt the AI while it's speaking (main prompt only).
- **Lower values (e.g., 0.0-0.4)**: Easier to interrupt, more sensitive to user speech
- **Medium values (e.g., 0.5-0.7)**: Balanced interruption sensitivity
- **Higher values (e.g., 0.8-1.0)**: Harder to interrupt, requires clear user speech

### presence_penalty
Topic diversity control. Penalizes tokens based on whether they appear in the conversation so far.
- **Negative values**: Encourages repetition of topics
- **Zero**: No penalty
- **Positive values**: Discourages repetition, encourages new topics

### frequency_penalty
Repetition control. Penalizes tokens based on their frequency in the conversation.
- **Negative values**: Encourages repetition of specific words
- **Zero**: No penalty
- **Positive values**: Discourages word repetition, encourages vocabulary variety

**Note:** No default values are sent unless explicitly set using the methods above. The server applies model-appropriate defaults if parameters are not specified.

## Use Case Examples

### Customer Service Agent
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
      barge_confidence: 0.6, // Moderate interruption threshold
      presence_penalty: 0.1, // Slight penalty to avoid repetition
      frequency_penalty: 0.1, // Encourage varied language
    });
  }
}
```

### Creative Writing Assistant
```typescript
class CreativeWritingAgent extends AgentBase {
  constructor() {
    super({ name: 'creative-writer', route: '/writer' });

    this.promptAddSection('Role', { body: 'You are a creative writing assistant.' });

    // Creative, diverse responses
    this.setPromptLlmParams({
      temperature: 0.8, // High randomness for creativity
      top_p: 0.95, // Wide token selection
      barge_confidence: 0.3, // Easy to interrupt for collaboration
      presence_penalty: -0.1, // Allow topic revisiting
      frequency_penalty: 0.3, // Encourage vocabulary diversity
    });
  }
}
```

### Technical Documentation Bot
```typescript
class TechnicalDocsAgent extends AgentBase {
  constructor() {
    super({ name: 'tech-docs', route: '/docs' });

    this.promptAddSection('Role', { body: 'You are a technical documentation assistant.' });

    // Precise, accurate responses
    this.setPromptLlmParams({
      temperature: 0.2, // Very low randomness
      top_p: 0.8, // More focused token selection
      barge_confidence: 0.8, // Hard to interrupt - let it finish
      presence_penalty: 0.0, // Neutral on repetition
      frequency_penalty: 0.2, // Some vocabulary variety
    });

    // Even more focused for summaries
    this.setPostPromptLlmParams({ temperature: 0.1 });
  }
}
```

### Legal Advisor Bot
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
      temperature: 0.2, // Very consistent
      top_p: 0.85, // Focused selection
      barge_confidence: 0.9, // Very hard to interrupt - legal accuracy important
      presence_penalty: 0.0, // Allow legal term repetition
      frequency_penalty: 0.0, // Legal language often repeats
    });
  }
}
```

## Best Practices

### 1. Start with Defaults
Begin with the server defaults (set nothing) and adjust based on observed behavior.

### 2. Test Incrementally
Make small adjustments and test thoroughly to understand the impact.

### 3. Consider the Use Case
- **Customer Service**: Low temperature (0.2-0.4), moderate barge_confidence (0.6-0.7)
- **Creative Tasks**: Higher temperature (0.7-0.9), low barge_confidence (0.4-0.6)
- **Technical/Legal**: Very low temperature (0.1-0.3), high barge_confidence (0.8-0.9)
- **General Assistant**: Medium temperature (0.5-0.7), medium barge_confidence (0.6-0.7)

### 4. Match Post-Prompt Parameters
Post-prompt parameters should typically be a lower temperature than the main prompt for consistent summaries.

### 5. Monitor Barge Confidence Levels
- Too high: Users have difficulty interrupting the AI
- Too low: AI gets interrupted too easily by background noise

## Parameter Interactions

### Temperature + Top-p
These parameters work together to control randomness:
- Low temperature + Low top_p = Very focused responses
- High temperature + High top_p = Maximum creativity
- Low temperature + High top_p = Consistent but with fallback options
- High temperature + Low top_p = Creative within constraints

### Penalty Parameters
Presence and frequency penalties can be used together:
- Both positive: Strong encouragement for variety
- Both negative: Strong encouragement for repetition
- Mixed: Fine-tuned control over specific repetition patterns

## Troubleshooting

### AI is too repetitive
- Increase `presence_penalty` (try 0.3-0.6)
- Increase `frequency_penalty` (try 0.3-0.6)
- Slightly increase `temperature`

### AI is too random/inconsistent
- Decrease `temperature` (try 0.2-0.4)
- Decrease `top_p` (try 0.7-0.85)

### AI gets interrupted too easily
- Increase `barge_confidence` threshold
- Check for background noise in the environment

### Users can't interrupt the AI
- Decrease `barge_confidence` threshold
- Consider the use case (e.g., legal/medical may need higher thresholds)

## Parameter Behavior

**No Default Values:** The SDK does not send any LLM parameters unless explicitly set via `setPromptLlmParams()` or `setPostPromptLlmParams()`. When parameters are not specified, the SignalWire server applies appropriate defaults based on the model.

**Server-Side Validation:** All parameter validation is handled by the SignalWire server. The SDK accepts any parameters and passes them through unchanged. This allows:
- Use of model-specific parameters without SDK updates
- Forward compatibility with new models and parameters
- Server-side optimization based on model capabilities

**Partial Configuration:** You can set only the parameters you want to customize:
```typescript
// Only set temperature, let the server handle the rest
agent.setPromptLlmParams({ temperature: 0.7 });

// Or set multiple specific parameters
agent.setPromptLlmParams({ temperature: 0.5, barge_confidence: 0.6 });
```

## Related

- [Agent Guide](agent-guide.md) — full `AgentBase` configuration reference, including `setParams()` for non-LLM AI parameters.
