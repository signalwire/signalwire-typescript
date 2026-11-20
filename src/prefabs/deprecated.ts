/**
 * Deprecation warnings for the prefabs the operations module replaces.
 * @internal
 */

const warned = new Set<string>();

/**
 * Warn, once per process, that a deprecated prefab was made: Node's
 * `DeprecationWarning`, with the replacement named in `message`.
 * @param name - The prefab's class name.
 * @param message - What to use instead, and why.
 * @internal
 */
export function _warnDeprecated(name: string, message: string): void {
  if (warned.has(name)) return;
  warned.add(name);
  process.emitWarning(`${name} is deprecated: ${message}`, {
    type: 'DeprecationWarning',
    code: `SIGNALWIRE_${name.toUpperCase()}_DEPRECATED`,
  });
}

/** @internal For tests: forget which warnings were given. */
export function _resetDeprecationWarnings(): void {
  warned.clear();
}
