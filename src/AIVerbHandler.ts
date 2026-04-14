/**
 * AIVerbHandler - Handler for the SWML 'ai' verb.
 *
 * The 'ai' verb is complex and requires specialized handling, particularly
 * for managing prompts, SWAIG functions, and AI configurations.
 *
 * Equivalent to Python SDK's `AIVerbHandler` in `swml_handler.py`.
 */

import { SWMLVerbHandler } from './SWMLVerbHandler.js';

/** Options accepted by {@link AIVerbHandler.buildConfig}. */
export interface AIVerbBuildOptions {
  /** Text prompt for the AI (mutually exclusive with promptPom). */
  promptText?: string;
  /** POM structure for the AI prompt (mutually exclusive with promptText). */
  promptPom?: Record<string, unknown>[];
  /** Optional contexts and steps configuration (can be combined with text or pom). */
  contexts?: Record<string, unknown>;
  /** Optional post-prompt text. */
  postPrompt?: string;
  /** Optional URL for post-prompt processing. */
  postPromptUrl?: string;
  /** Optional SWAIG configuration. */
  swaig?: Record<string, unknown>;
  /** Additional AI parameters; see {@link AIVerbHandler.buildConfig} for routing rules. */
  [key: string]: unknown;
}

/** Handler for the SWML 'ai' verb. */
export class AIVerbHandler extends SWMLVerbHandler {
  /**
   * Get the name of the verb this handler handles.
   * @returns "ai" as the verb name.
   */
  getVerbName(): string {
    return 'ai';
  }

  /**
   * Validate the configuration for the AI verb.
   *
   * Checks that:
   * - `prompt` is present and is an object
   * - `prompt` contains exactly one of `text` or `pom` (mutually exclusive)
   * - `prompt.contexts`, if present, is an object
   * - `SWAIG`, if present, is an object
   *
   * @param config - The configuration dictionary for the AI verb.
   * @returns A [isValid, errorMessages] tuple.
   */
  validateConfig(config: Record<string, unknown>): [boolean, string[]] {
    const errors: string[] = [];

    // Check that prompt is present
    if (!('prompt' in config)) {
      errors.push("Missing required field 'prompt'");
      return [false, errors];
    }

    const prompt = config['prompt'];
    if (typeof prompt !== 'object' || prompt === null || Array.isArray(prompt)) {
      errors.push("'prompt' must be an object");
      return [false, errors];
    }

    const p = prompt as Record<string, unknown>;

    // Check that prompt contains either text or pom (required, mutually exclusive)
    const hasText = 'text' in p;
    const hasPom = 'pom' in p;
    const hasContexts = 'contexts' in p;

    const basePromptCount = [hasText, hasPom].filter(Boolean).length;
    if (basePromptCount === 0) {
      errors.push("'prompt' must contain either 'text' or 'pom' as base prompt");
    } else if (basePromptCount > 1) {
      errors.push("'prompt' can only contain one of: 'text' or 'pom' (mutually exclusive)");
    }

    // Contexts are optional and can be combined with text or pom
    if (hasContexts) {
      const contexts = p['contexts'];
      if (typeof contexts !== 'object' || contexts === null || Array.isArray(contexts)) {
        errors.push("'prompt.contexts' must be an object");
      }
    }

    // Validate SWAIG structure if present
    if ('SWAIG' in config) {
      const swaig = config['SWAIG'];
      if (typeof swaig !== 'object' || swaig === null || Array.isArray(swaig)) {
        errors.push("'SWAIG' must be an object");
      }
    }

    return [errors.length === 0, errors];
  }

  /**
   * Build a configuration for the AI verb.
   *
   * Requires exactly one of `promptText` or `promptPom` (mutually exclusive).
   * Throws an `Error` if both or neither are provided.
   *
   * Extra keys in `opts` are routed as follows:
   * - `languages`, `hints`, `pronounce`, `globalData` / `global_data` are placed at the top level of the config.
   * - All other extra keys are placed into `config.params`.
   *
   * @param opts - Build options for the AI verb configuration.
   * @returns AI verb configuration dictionary.
   */
  buildConfig(opts: AIVerbBuildOptions = {}): Record<string, unknown> {
    const {
      promptText,
      promptPom,
      contexts,
      postPrompt,
      postPromptUrl,
      swaig,
      ...rest
    } = opts;

    const config: Record<string, unknown> = {};

    // Require either text or pom as base prompt (mutually exclusive)
    const basePromptCount = [promptText, promptPom].filter((v) => v !== undefined).length;
    if (basePromptCount === 0) {
      throw new Error('Either promptText or promptPom must be provided as base prompt');
    } else if (basePromptCount > 1) {
      throw new Error('promptText and promptPom are mutually exclusive');
    }

    // Build prompt object with base prompt
    const promptConfig: Record<string, unknown> = {};
    if (promptText !== undefined) {
      promptConfig['text'] = promptText;
    } else if (promptPom !== undefined) {
      promptConfig['pom'] = promptPom;
    }

    // Add contexts if provided (optional, activates steps feature)
    if (contexts !== undefined) {
      promptConfig['contexts'] = contexts;
    }

    config['prompt'] = promptConfig;

    // Add post-prompt if provided
    if (postPrompt !== undefined) {
      config['post_prompt'] = { text: postPrompt };
    }

    // Add post-prompt URL if provided
    if (postPromptUrl !== undefined) {
      config['post_prompt_url'] = postPromptUrl;
    }

    // Add SWAIG if provided
    if (swaig !== undefined) {
      config['SWAIG'] = swaig;
    }

    // Add any additional parameters
    // Match Python behavior: always initialize params dict
    if (!('params' in config)) {
      config['params'] = {} as Record<string, unknown>;
    }

    const topLevelKeys = new Set(['languages', 'hints', 'pronounce', 'global_data', 'globalData']);
    for (const [key, value] of Object.entries(rest)) {
      if (topLevelKeys.has(key)) {
        // Route globalData to the snake_case key expected by SWML
        config[key === 'globalData' ? 'global_data' : key] = value;
      } else {
        // Add to params object
        (config['params'] as Record<string, unknown>)[key] = value;
      }
    }

    return config;
  }
}
