/**
 * Capabilities - reading what a client says it can do.
 *
 * A browser client (the SignalWire address widget, or anything speaking the
 * same convention) declares its rendering capabilities in the user variables
 * it sends at dial time:
 *
 * ```json
 * { "vars": { "userVariables": {
 *     "capabilities": { "display_content": true, "transcript": true, "chat_handoff": false },
 *     "metadata": { "page": {}, "client": {}, "widget": {} } } } }
 * ```
 *
 * These are declarations of what the client can RENDER, not grants of
 * authority. Treat them as hints for deciding what to offer (whether to push
 * content to a screen, whether to advertise a text-handoff tool), never as
 * permission to do anything privileged: a caller controls its own user
 * variables.
 *
 * Absence means no. Every function here resolves errors and missing data to
 * "not declared", because offering a caller something they can't reach is
 * worse than never mentioning it: a phone caller has no screen.
 *
 * There's deliberately no list of known capability names: a client can declare
 * one this SDK has never heard of, and an application can act on it today.
 * Mirrors signalwire-python's `signalwire.core.capabilities`.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The user variables from a SWML request body (`vars.userVariables`), or `{}`.
 *
 * They're nested two levels down, which is easy to get wrong silently: a
 * missing level yields an empty object, and every later check reports "not
 * declared".
 *
 * @param bodyParams - The SWML request body.
 * @returns The user variables, or an empty object.
 */
export function userVariables(bodyParams: unknown): Record<string, unknown> {
  if (!isPlainObject(bodyParams)) return {};
  const vars = bodyParams['vars'];
  if (!isPlainObject(vars)) return {};
  const variables = vars['userVariables'];
  return isPlainObject(variables) ? variables : {};
}

/**
 * The capability names the client declared as truthy.
 *
 * Accepts either a whole SWML request body or already-extracted user
 * variables, so it works from a dynamic config callback and from a tool
 * handler alike.
 *
 * @param bodyParams - A SWML request body, or a user variables object.
 * @returns The declared names; empty when nothing was declared, the payload
 *   was malformed, or the client isn't a browser at all.
 *
 * @example
 * ```ts
 * if (declaredCapabilities(body).has('display_content')) {
 *   agent.promptAddSection('Screen', { body: 'You can show the caller content.' });
 * }
 * ```
 */
export function declaredCapabilities(bodyParams: unknown): ReadonlySet<string> {
  let variables = userVariables(bodyParams);
  if (Object.keys(variables).length === 0 && isPlainObject(bodyParams)) {
    // Already-extracted user variables were passed directly.
    variables = bodyParams;
  }
  const capabilities = variables['capabilities'];
  if (!isPlainObject(capabilities)) return new Set();
  return new Set(
    Object.entries(capabilities)
      .filter(([, value]) => Boolean(value))
      .map(([name]) => name),
  );
}

/**
 * Whether the client declared `name` as truthy.
 * @param bodyParams - A SWML request body, or a user variables object.
 * @param name - Capability name, e.g. `display_content`.
 * @returns True only when explicitly declared truthy.
 */
export function hasCapability(bodyParams: unknown, name: string): boolean {
  return declaredCapabilities(bodyParams).has(name);
}
