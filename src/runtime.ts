/**
 * Runtime detection helpers.
 *
 * Used by the serve abstraction to choose between Bun.serve and
 * @hono/node-server. Keep this tiny and side-effect free — the module
 * is imported during cold start in serverless and CLI code paths.
 */

/** True when running under Bun. */
export const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined';

/** True when running under Deno. Not used yet; reserved for a future branch. */
export const isDeno = typeof (globalThis as { Deno?: unknown }).Deno !== 'undefined';

/** True when running under Node.js (and not Bun / Deno). */
export const isNode = !isBun && !isDeno && typeof process !== 'undefined' && process.versions?.node != null;
