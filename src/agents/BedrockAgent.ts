/**
 * BedrockAgent - Amazon Bedrock voice-to-voice integration.
 *
 * Extends {@link AgentBase} to support Amazon Bedrock's voice-to-voice model
 * while keeping full compatibility with the SignalWire agent ecosystem
 * (skills, POM, SWAIG functions, post-prompt). The one behavioral difference
 * from a standard agent is that the rendered SWML uses the `amazon_bedrock`
 * verb instead of `ai`. Speech hints, languages, pronunciation rules,
 * multilingual settings and contexts aren't part of that verb, so they're
 * left out of the SWML, with one warning per agent for each.
 *
 * Ported from the Python SDK `signalwire.agents.bedrock.BedrockAgent`.
 */

import { AgentBase } from '../AgentBase.js';
import type { AgentOptions } from '../types.js';

/** The `ai` verb keys the `amazon_bedrock` verb carries over; the rest are left out. */
const BEDROCK_VERB_KEYS: ReadonlySet<string> = new Set([
  'prompt',
  'SWAIG',
  'params',
  'global_data',
  'post_prompt',
  'post_prompt_url',
]);

/**
 * The prompt keys copied from the `ai` verb's prompt. The platform's Bedrock
 * session reads only these, `voice_id`, `temperature` and `top_p`; the last
 * three are set from the agent's own settings, as is `max_tokens`.
 */
const BEDROCK_PROMPT_KEYS: ReadonlySet<string> = new Set(['text', 'pom']);

/** The prompt keys set from the agent's own settings. */
const AGENT_PROMPT_KEYS: ReadonlySet<string> = new Set([
  'voice_id',
  'temperature',
  'top_p',
  'max_tokens',
]);

/** What the `ai` verb keys that Bedrock leaves out are, for the warning. */
const FEATURE_NAMES: Readonly<Record<string, string>> = {
  hints: "speech hints (addHint(), addHints(), addPatternHint() and skills' hints)",
  languages: 'languages (addLanguage())',
  pronounce: 'pronunciation rules (addPronunciation())',
  multilingual: 'multilingual settings (setMultilingual())',
  contexts: 'contexts and steps (defineContexts())',
};

/** A SWML variable reference, such as `${temperature}`, which the schema accepts for temperature and top_p. */
const SWML_VAR = /^[$%]\{.*\}$/;

/** A decimal number as a string, such as `0.7`, `-1`, `.5` or `1e3` (not `0x10` or `''`). */
const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

/** `"it's"` for one name and `"they're"` for more, for the warnings below. */
function itOrThey(names: string[]): string {
  return names.length === 1 ? "it's" : "they're";
}

/** A value as it appears in an error message. */
function describeValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Return `value` as a number for the Bedrock prompt, or throw.
 *
 * Accepts a number or a numeric string. `temperature` and `top_p` may also be
 * a SWML variable reference such as `${temperature}`, which the schema allows
 * and which is passed through as written.
 *
 * @throws Error if the value isn't a finite number (or an integer, for `max_tokens`).
 */
function toNumber(name: string, value: unknown, integer: true): number;
function toNumber(name: string, value: unknown, integer?: false): number | string;
function toNumber(name: string, value: unknown, integer = false): number | string {
  if (!integer && typeof value === 'string' && SWML_VAR.test(value.trim())) return value.trim();
  const fail = (): never => {
    throw new Error(
      `BedrockAgent ${name} must be ${integer ? 'an integer' : 'a number'}, got ${describeValue(value)}`,
    );
  };
  let number: number;
  if (typeof value === 'number') number = value;
  else if (typeof value === 'string' && DECIMAL.test(value.trim())) number = Number(value.trim());
  else return fail();
  if (!Number.isFinite(number)) return fail();
  if (integer && !Number.isInteger(number)) return fail();
  return number;
}

/** Configuration for the {@link BedrockAgent}. */
export interface BedrockAgentConfig {
  /** Agent display name (defaults to `"bedrock_agent"`). */
  name?: string;
  /** HTTP route for this agent (defaults to `"/bedrock"`). */
  route?: string;
  /** Initial system prompt (can be overridden later with `setPromptText`). */
  systemPrompt?: string;
  /** Bedrock voice: `tiffany`, `matthew`, `amy`, `lupe` or `carlos` (defaults to `"matthew"`). */
  voiceId?: string;
  /**
   * Generation temperature (0-2). Defaults to 0.7. A numeric string is
   * converted, and a SWML variable reference such as `${temperature}` is
   * passed through.
   */
  temperature?: number | string;
  /**
   * Nucleus sampling parameter (0-1). Defaults to 0.9. A numeric string is
   * converted, and a SWML variable reference such as `${top_p}` is passed
   * through.
   */
  topP?: number | string;
  /**
   * Maximum tokens to generate. Defaults to 1024. A numeric string is
   * converted. The platform's Bedrock session doesn't read it; it uses 1024.
   */
  maxTokens?: number | string;
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
 *   voiceId: 'tiffany',
 * });
 *
 * agent.setInferenceParams(0.5, 0.95, 2048);
 * await agent.serve({ port: 3000 });
 * ```
 */
export class BedrockAgent extends AgentBase {
  private _voiceId: string;
  private _temperature: number | string;
  private _topP: number | string;
  private _maxTokens: number;
  /**
   * Features already reported as left out of the `amazon_bedrock` verb, so
   * each is reported once per agent. A per-request copy shares this set.
   */
  private _bedrockDroppedWarned = new Set<string>();

  /**
   * Create a BedrockAgent.
   * @param config - Configuration including voice, inference params, and optional system prompt.
   * @throws Error if `temperature` or `topP` isn't a number, or `maxTokens` isn't an integer.
   */
  constructor(config: BedrockAgentConfig = {}) {
    // Check the inference settings before building the agent.
    const temperature = toNumber('temperature', config.temperature ?? 0.7);
    const topP = toNumber('top_p', config.topP ?? 0.9);
    const maxTokens = toNumber('max_tokens', config.maxTokens ?? 1024, true);

    super({
      name: config.name ?? 'bedrock_agent',
      route: config.route ?? '/bedrock',
      ...config.agentOptions,
    });

    // Store Bedrock-specific parameters.
    this._voiceId = config.voiceId ?? 'matthew';
    this._temperature = temperature;
    this._topP = topP;
    this._maxTokens = maxTokens;

    // Set initial prompt if provided (after super init).
    if (config.systemPrompt) {
      this.setPromptText(config.systemPrompt);
    }

    this.log.info(`BedrockAgent initialized: ${this.name} on route ${this.route}`);
  }

  /**
   * Render the SWML document, transforming the base `ai` verb into an
   * `amazon_bedrock` verb with the same structure. Mirrors Python
   * `BedrockAgent._render_swml`.
   *
   * Only `prompt`, `SWAIG`, `params`, `global_data`, `post_prompt` and
   * `post_prompt_url` are carried over. Anything else on the `ai` verb, such
   * as `hints`, `languages`, `pronounce`, `multilingual` or the debug webhook
   * keys, is left out, as is anything in the prompt that the Bedrock prompt
   * doesn't define, such as `contexts`. The agent logs one warning for each
   * feature it leaves out, the first time it leaves it out.
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
        // The ai verb's other keys (hints, languages, pronounce,
        // multilingual) have no place in the amazon_bedrock verb.
        this.warnDropped(
          Object.keys(aiConfig).filter((key) => !BEDROCK_VERB_KEYS.has(key)),
          'the amazon_bedrock verb has no',
        );

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

  /** Log a warning, once per agent, for each feature left out of the SWML. */
  private warnDropped(keys: string[], reason: string): void {
    for (const key of keys) {
      if (this._bedrockDroppedWarned.has(key)) continue;
      this._bedrockDroppedWarned.add(key);
      const what = key in FEATURE_NAMES ? `the agent's ${FEATURE_NAMES[key]} are` : "it's";
      this.log.warn(`BedrockAgent: ${reason} ${key}, so ${what} left out of the SWML`);
    }
  }

  /**
   * Add voice configuration to the prompt object. In Bedrock, voice and
   * inference params are part of the prompt object (not separate fields).
   * Mirrors Python `_add_voice_to_prompt`.
   */
  private addVoiceToPrompt(promptConfig: Record<string, unknown>): Record<string, unknown> {
    const filtered: Record<string, unknown> = {};
    // Copy the prompt text. Anything else, such as confidence or contexts, is
    // left out: the platform's Bedrock session doesn't read it.
    for (const [key, value] of Object.entries(promptConfig)) {
      if (BEDROCK_PROMPT_KEYS.has(key)) filtered[key] = value;
    }
    // voice_id and the inference settings are replaced below, so only the
    // other keys are features the Bedrock prompt leaves out.
    this.warnDropped(
      Object.keys(promptConfig).filter(
        (key) => !BEDROCK_PROMPT_KEYS.has(key) && !AGENT_PROMPT_KEYS.has(key),
      ),
      "Bedrock's prompt has no",
    );
    filtered['voice_id'] = this._voiceId;
    filtered['temperature'] = this._temperature;
    filtered['top_p'] = this._topP;
    filtered['max_tokens'] = this._maxTokens;
    return filtered;
  }

  /**
   * Set the Bedrock voice: `tiffany`, `matthew`, `amy`, `lupe` or `carlos`.
   * Mirrors Python `set_voice`.
   */
  setVoice(voiceId: string): this {
    this._voiceId = voiceId;
    this.log.debug(`Voice set to: ${voiceId}`);
    return this;
  }

  /**
   * Update Bedrock inference parameters. Any argument left undefined (or
   * null) is unchanged. Each value may be a number or a numeric string, which
   * is converted. `temperature` and `topP` may also be a SWML variable
   * reference such as `${temperature}`. The platform's Bedrock session applies
   * `temperature` (0 to 2) and `topP` (0 to 1), and doesn't read `maxTokens`: it
   * uses 1024. Mirrors Python `set_inference_params`.
   *
   * @throws Error if `temperature` or `topP` isn't a number, or `maxTokens`
   *   isn't an integer. Nothing is changed when a value is refused.
   */
  setInferenceParams(
    temperature?: number | string | null,
    topP?: number | string | null,
    maxTokens?: number | string | null,
  ): this {
    // Convert all three before changing any, so a refused value leaves the
    // settings as they were.
    const newTemperature = temperature != null ? toNumber('temperature', temperature) : undefined;
    const newTopP = topP != null ? toNumber('top_p', topP) : undefined;
    const newMaxTokens = maxTokens != null ? toNumber('max_tokens', maxTokens, true) : undefined;
    if (newTemperature !== undefined) this._temperature = newTemperature;
    if (newTopP !== undefined) this._topP = newTopP;
    if (newMaxTokens !== undefined) this._maxTokens = newMaxTokens;
    this.log.debug(
      `Inference params updated: temp=${this._temperature}, top_p=${this._topP}, max_tokens=${this._maxTokens}`,
    );
    return this;
  }

  /**
   * Set the LLM model — not applicable for Bedrock, which uses a fixed
   * voice-to-voice model. Logs a warning and does nothing.
   * Mirrors Python `set_llm_model`.
   */
  setLlmModel(model: string): this {
    this.log.warn(`setLlmModel('${model}') called but Bedrock uses a fixed voice-to-voice model`);
    return this;
  }

  /**
   * Set the LLM temperature — redirects to {@link setInferenceParams}.
   * Mirrors Python `set_llm_temperature`.
   *
   * @throws Error if `temperature` isn't a number or a SWML variable reference.
   */
  setLlmTemperature(temperature: number | string): this {
    return this.setInferenceParams(temperature);
  }

  /**
   * Set post-prompt LLM parameters — not applicable for Bedrock (its
   * post-prompt uses OpenAI configured in the engine). Logs a warning.
   * Mirrors Python `set_post_prompt_llm_params`.
   */
  setPostPromptLlmParams(_params: Record<string, unknown>): this {
    this.log.warn(
      'setPostPromptLlmParams() called but Bedrock post-prompt uses OpenAI configured in the engine',
    );
    return this;
  }

  /**
   * Set the prompt's inference settings.
   *
   * `temperature`, `top_p` and `max_tokens` update the inference settings, as
   * {@link setInferenceParams} does, which converts numeric strings and
   * throws for other values. The platform's Bedrock session reads no other
   * prompt setting, so anything else, such as `confidence`,
   * `presence_penalty` or `barge_confidence`, is ignored with a warning.
   * Mirrors Python `set_prompt_llm_params`.
   *
   * @param params - Prompt settings, with their SWML names.
   * @returns This agent, for chaining.
   * @throws Error if `temperature` or `top_p` isn't a number, or `max_tokens`
   *   isn't an integer. Nothing is changed when a value is refused.
   */
  override setPromptLlmParams(params: Record<string, unknown>): this {
    const rest = { ...params };
    const take = (key: string): number | string | undefined => {
      const value = rest[key];
      delete rest[key];
      // setInferenceParams() checks the value, and treats null as not given.
      return value as number | string | undefined;
    };
    this.setInferenceParams(take('temperature'), take('top_p'), take('max_tokens'));
    const ignored = Object.keys(rest).sort();
    if (ignored.length > 0) {
      this.log.warn(
        `setPromptLlmParams(): the platform's Bedrock session doesn't use ${ignored.join(', ')}, so ${itOrThey(ignored)} ignored`,
      );
    }
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
