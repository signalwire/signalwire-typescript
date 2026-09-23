/**
 * BedrockAgent - Amazon Bedrock voice-to-voice integration.
 *
 * Extends {@link AgentBase} to support Amazon Bedrock's voice-to-voice model
 * while keeping full compatibility with the SignalWire agent ecosystem
 * (skills, POM, SWAIG functions, post-prompt). The one behavioral difference
 * from a standard agent is that the rendered SWML uses the `amazon_bedrock`
 * verb instead of `ai`.
 */

import { AgentBase } from '../AgentBase.js';
import type { AgentOptions } from '../types.js';

/** Configuration for the {@link BedrockAgent}. */
export interface BedrockAgentConfig {
  /** Agent display name (defaults to `"bedrock_agent"`). */
  name?: string;
  /** HTTP route for this agent (defaults to `"/bedrock"`). */
  route?: string;
  /** Initial system prompt (can be overridden later with `setPromptText`). */
  systemPrompt?: string;
  /** Bedrock voice ID (defaults to `"matthew"`). */
  voiceId?: string;
  /** Generation temperature (0-1). Defaults to 0.7. */
  temperature?: number;
  /** Nucleus sampling parameter (0-1). Defaults to 0.9. */
  topP?: number;
  /** Maximum tokens to generate. Defaults to 1024. */
  maxTokens?: number;
  /** Additional AgentBase options forwarded to `super()`. */
  agentOptions?: Partial<AgentOptions>;
}

/**
 * Agent implementation for the Amazon Bedrock voice-to-voice model.
 *
 * Supports all standard agent features (prompt building with text and POM,
 * skills and SWAIG functions, post-prompt, dynamic configuration) but renders
 * SWML with the `amazon_bedrock` verb rather than `ai`.
 *
 * @example
 * ```ts
 * import { BedrockAgent } from '@signalwire/sdk';
 *
 * const agent = new BedrockAgent({
 *   systemPrompt: 'You are a helpful voice assistant.',
 *   voiceId: 'joanna',
 * });
 *
 * agent.setInferenceParams(0.5, 0.95, 2048);
 * await agent.serve({ port: 3000 });
 * ```
 */
export class BedrockAgent extends AgentBase {
  private _voiceId: string;
  private _temperature: number;
  private _topP: number;
  private _maxTokens: number;

  /**
   * Create a BedrockAgent.
   * @param config - Configuration including voice, inference params, and optional system prompt.
   */
  constructor(config: BedrockAgentConfig = {}) {
    super({
      name: config.name ?? 'bedrock_agent',
      route: config.route ?? '/bedrock',
      ...config.agentOptions,
    });

    // Store Bedrock-specific parameters.
    this._voiceId = config.voiceId ?? 'matthew';
    this._temperature = config.temperature ?? 0.7;
    this._topP = config.topP ?? 0.9;
    this._maxTokens = config.maxTokens ?? 1024;

    // Set initial prompt if provided (after super init).
    if (config.systemPrompt) {
      this.setPromptText(config.systemPrompt);
    }

    this.log.info(`BedrockAgent initialized: ${this.name} on route ${this.route}`);
  }

  /**
   * Render the SWML document, transforming the base `ai` verb into an
   * `amazon_bedrock` verb with the same structure.
   */
  override renderSwml(callId?: string, modifications?: Record<string, unknown>): string {
    // Build the base SWML with the ai verb, then transform it.
    const baseSwmlJson = super.renderSwml(callId, modifications);
    const swml = JSON.parse(baseSwmlJson) as Record<string, unknown>;

    const sections = (swml['sections'] as Record<string, unknown>) ?? {};
    const mainSection = (sections['main'] as Record<string, unknown>[]) ?? [];

    for (let i = 0; i < mainSection.length; i++) {
      const verb = mainSection[i]!;
      if ('ai' in verb) {
        const aiConfig = (verb['ai'] as Record<string, unknown>) ?? {};

        // Build the amazon_bedrock verb with the same structure. Voice and
        // inference params live inside the prompt object for Bedrock.
        const bedrockConfig: Record<string, unknown> = {
          prompt: this.addVoiceToPrompt((aiConfig['prompt'] as Record<string, unknown>) ?? {}),
          SWAIG: aiConfig['SWAIG'] ?? {},
          params: aiConfig['params'] ?? {},
          global_data: aiConfig['global_data'] ?? {},
          post_prompt: aiConfig['post_prompt'],
          post_prompt_url: aiConfig['post_prompt_url'],
        };

        // Remove undefined/null values.
        const cleaned: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(bedrockConfig)) {
          if (v !== undefined && v !== null) cleaned[k] = v;
        }

        mainSection[i] = { amazon_bedrock: cleaned };
        break;
      }
    }

    return JSON.stringify(swml);
  }

  /**
   * Add voice configuration to the prompt object. In Bedrock, voice and
   * inference params are part of the prompt object (not separate fields).
   */
  private addVoiceToPrompt(promptConfig: Record<string, unknown>): Record<string, unknown> {
    const filtered: Record<string, unknown> = {};
    // Skip text-model-specific parameters that don't apply to Bedrock's
    // voice-to-voice model.
    const skip = new Set(['barge_confidence', 'presence_penalty', 'frequency_penalty']);
    for (const [key, value] of Object.entries(promptConfig)) {
      if (skip.has(key)) continue;
      filtered[key] = value;
    }
    filtered['voice_id'] = this._voiceId;
    filtered['temperature'] = this._temperature;
    filtered['top_p'] = this._topP;
    return filtered;
  }

  /**
   * Set the Bedrock voice ID (e.g. `"matthew"`, `"joanna"`).
   */
  setVoice(voiceId: string): this {
    this._voiceId = voiceId;
    this.log.debug(`Voice set to: ${voiceId}`);
    return this;
  }

  /**
   * Update Bedrock inference parameters. Any argument left undefined is
   * unchanged.
   */
  setInferenceParams(temperature?: number, topP?: number, maxTokens?: number): this {
    if (temperature !== undefined) this._temperature = temperature;
    if (topP !== undefined) this._topP = topP;
    if (maxTokens !== undefined) this._maxTokens = maxTokens;
    this.log.debug(
      `Inference params updated: temp=${this._temperature}, top_p=${this._topP}, max_tokens=${this._maxTokens}`,
    );
    return this;
  }

  /**
   * Set the LLM model — not applicable for Bedrock, which uses a fixed
   * voice-to-voice model. Logs a warning and does nothing.
   */
  setLlmModel(model: string): this {
    this.log.warn(`setLlmModel('${model}') called but Bedrock uses a fixed voice-to-voice model`);
    return this;
  }

  /**
   * Set the LLM temperature — redirects to {@link setInferenceParams}.
   */
  setLlmTemperature(temperature: number): this {
    return this.setInferenceParams(temperature);
  }

  /**
   * Set post-prompt LLM parameters — not applicable for Bedrock (its
   * post-prompt uses OpenAI configured in the engine). Logs a warning.
   */
  setPostPromptLlmParams(_params: Record<string, unknown>): this {
    this.log.warn(
      'setPostPromptLlmParams() called but Bedrock post-prompt uses OpenAI configured in the engine',
    );
    return this;
  }

  /**
   * Set prompt LLM parameters — use {@link setInferenceParams} instead for
   * Bedrock. Logs a warning.
   */
  setPromptLlmParams(_params: Record<string, unknown>): this {
    this.log.warn('setPromptLlmParams() called - use setInferenceParams() for Bedrock');
    return this;
  }
}

/**
 * Factory function that creates and returns a new BedrockAgent.
 * @param config - Configuration for the Bedrock agent.
 * @returns A configured BedrockAgent instance.
 */
export function createBedrockAgent(config: BedrockAgentConfig = {}): BedrockAgent {
  return new BedrockAgent(config);
}

export default BedrockAgent;
