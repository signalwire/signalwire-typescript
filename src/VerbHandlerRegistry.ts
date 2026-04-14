/**
 * VerbHandlerRegistry - Registry for SWML verb handlers.
 *
 * Maintains a map of {@link SWMLVerbHandler} instances keyed by verb name
 * and provides methods for registration, lookup, and existence checks.
 * Registers the default {@link AIVerbHandler} at construction time.
 *
 * Mirrors Python SDK's `VerbHandlerRegistry` (signalwire/core/swml_handler.py lines 210-257).
 */

import type { SWMLVerbHandler } from './SWMLVerbHandler.js';
import { AIVerbHandler } from './AIVerbHandler.js';

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
