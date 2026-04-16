/**
 * SWMLHandler - SWML verb handler framework.
 *
 * Consolidates the abstract {@link SWMLVerbHandler} base class, the
 * concrete {@link AIVerbHandler} for the SWML "ai" verb (including its
 * {@link AIVerbBuildOptions} build signature), and the {@link VerbHandlerRegistry}
 * that maps verb names to handler instances.
 *
 * Verb handlers provide specialized logic for complex SWML verbs that
 * cannot be handled generically by the schema-driven SwmlBuilder.
 * The "ai" verb is complex and requires specialized handling, particularly
 * for managing prompts, SWAIG functions, and AI configurations.
 *
 * Register implementations via {@link VerbHandlerRegistry.registerHandler}.
 *
 * Mirrors Python SDK's single-file layout in
 * `signalwire/signalwire/core/swml_handler.py`.
 */

/**
 * Abstract base class for pluggable SWML verb handlers.
 *
 * Each concrete handler owns one verb name and provides validate/build
 * logic for that verb's configuration. Subclass this to create handlers
 * for custom or complex SWML verbs that require specialized handling
 * beyond generic schema-driven validation.
 *
 * @example
 * ```ts
 * class MyVerbHandler extends SWMLVerbHandler {
 *   getVerbName(): string { return 'my_verb'; }
 *   validateConfig(config: Record<string, unknown>): [boolean, string[]] {
 *     const errors: string[] = [];
 *     if (!config['url']) errors.push("Missing required field 'url'");
 *     return [errors.length === 0, errors];
 *   }
 *   buildConfig(opts: Record<string, unknown>): Record<string, unknown> {
 *     return { url: opts['url'] };
 *   }
 * }
 * ```
 */
export abstract class SWMLVerbHandler {
  /**
   * Get the name of the SWML verb this handler handles.
   * @returns The verb name as a string (e.g. "ai", "play").
   */
  abstract getVerbName(): string;

  /**
   * Validate the configuration for this verb.
   * @param config - The configuration dictionary for this verb.
   * @returns A `[isValid, errorMessages]` tuple where `isValid` is `true`
   *          when the config is valid and `errorMessages` lists any issues found.
   */
  abstract validateConfig(config: Record<string, unknown>): [boolean, string[]];

  /**
   * Build a configuration object for this verb from the provided arguments.
   * @param opts - Key-value arguments specific to this verb.
   * @returns A configuration dictionary ready for inclusion in a SWML document.
   */
  abstract buildConfig(opts: Record<string, unknown>): Record<string, unknown>;
}

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

/**
 * Registry for SWML verb handlers.
 *
 * This class maintains a registry of handlers for special SWML verbs
 * and provides methods for accessing and using them. The "ai" verb handler
 * ({@link AIVerbHandler}) is registered automatically on construction.
 *
 * @example
 * ```ts
 * const registry = new VerbHandlerRegistry();
 *
 * // The "ai" handler is already registered
 * registry.hasHandler('ai'); // true
 *
 * // Register a custom handler
 * registry.registerHandler(new MyCustomVerbHandler());
 *
 * // Look up a handler
 * const handler = registry.getHandler('ai');
 * if (handler) {
 *   const [valid, errors] = handler.validateConfig(config);
 * }
 * ```
 */
export class VerbHandlerRegistry {
  private handlers: Map<string, SWMLVerbHandler> = new Map();

  /** Initialize the registry with default handlers. */
  constructor() {
    // Register default handlers (matches Python's __init__)
    this.registerHandler(new AIVerbHandler());
  }

  /**
   * Register a new verb handler, replacing any existing handler for the same verb name.
   * @param handler - The handler to register.
   */
  registerHandler(handler: SWMLVerbHandler): void {
    const verbName = handler.getVerbName();
    this.handlers.set(verbName, handler);
  }

  /**
   * Get the handler for a specific verb.
   * @param verbName - The name of the verb (e.g. "ai").
   * @returns The handler if found, or `undefined` otherwise.
   */
  getHandler(verbName: string): SWMLVerbHandler | undefined {
    return this.handlers.get(verbName);
  }

  /**
   * Check if a handler exists for a specific verb.
   * @param verbName - The name of the verb.
   * @returns `true` if a handler is registered for the verb, `false` otherwise.
   */
  hasHandler(verbName: string): boolean {
    return this.handlers.has(verbName);
  }
}
