/**
 * SWMLVerbHandler - Abstract base class for SWML verb handlers.
 *
 * Defines the interface that all SWML verb handlers must implement.
 * Verb handlers provide specialized logic for complex SWML verbs
 * that cannot be handled generically by the schema-driven SwmlBuilder.
 *
 * Register implementations via {@link VerbHandlerRegistry.registerHandler}.
 *
 * Mirrors Python SDK's `SWMLVerbHandler` (signalwire/core/swml_handler.py).
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
