/**
 * Agent discovery via dynamic import for swaig-test CLI.
 *
 * Finds the AgentBase or SWMLService to test, in this order:
 * 1. The export named by `--agent-class` (an instance, or a class to instantiate).
 * 2. With `--route`, the service whose route it is.
 * 3. Named export `agent`, then the default export, then any exported
 *    instance, then an exported class (instantiated).
 * 4. A service the file constructed without exporting it (the quickstart's
 *    `const agent = new AgentBase(...)`; `agent.run()`), found because
 *    SWMLService records itself while the CLI imports a file.
 */

import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { _takeCliLoadedServices } from '../SWMLService.js';

/** Allowed file extensions for agent loading. */
const ALLOWED_EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.mts']);

function isAgentInstance(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const a = obj as Record<string, unknown>;
  return (
    typeof a['renderSwml'] === 'function' &&
    typeof a['defineTool'] === 'function' &&
    typeof a['getPrompt'] === 'function'
  );
}

function isAgentClass(obj: unknown): boolean {
  if (typeof obj !== 'function') return false;
  const proto = (obj as { prototype?: Record<string, unknown> }).prototype;
  if (!proto) return false;
  return (
    typeof proto['renderSwml'] === 'function' &&
    typeof proto['defineTool'] === 'function' &&
    typeof proto['getPrompt'] === 'function'
  );
}

function isSWMLServiceInstance(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const a = obj as Record<string, unknown>;
  // SWMLService has SWAIG-hosting (defineTool) post-lift, just like
  // AgentBase. Distinguish them by getPrompt — agent-only.
  return (
    typeof a['renderSwml'] === 'function' &&
    typeof a['getApp'] === 'function' &&
    typeof a['addVerb'] === 'function' &&
    typeof a['getPrompt'] !== 'function'
  );
}

const isService = (obj: unknown) => isAgentInstance(obj) || isSWMLServiceInstance(obj);

/** A loaded module, plus the services it constructed while it was imported. */
interface LoadedModule {
  exports: Record<string, unknown>;
  constructed: unknown[];
}

/**
 * Import a module by path after validating the file extension.
 *
 * **Security note:** Only `.ts`, `.js`, `.mjs`, and `.mts` extensions are allowed
 * to prevent loading unexpected file types via dynamic import.
 */
async function importModule(agentPath: string): Promise<LoadedModule> {
  const absPath = resolve(agentPath);
  const ext = extname(absPath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(
      `Unsupported file extension '${ext}' for agent file: ${absPath}. ` +
        `Only ${[...ALLOWED_EXTENSIONS].join(', ')} files are allowed.`,
    );
  }
  const fileUrl = pathToFileURL(absPath).href;

  // Suppress server startup: agent files call .serve() at module scope,
  // but the CLI only needs the configured agent instance, not a running server.
  // In this mode, every SWMLService constructed also records itself.
  process.env['SWAIG_CLI_MODE'] = 'true';
  _takeCliLoadedServices();
  try {
    const exports = (await import(fileUrl)) as Record<string, unknown>;
    return { exports, constructed: _takeCliLoadedServices() };
  } catch (err) {
    throw new Error(`Failed to import agent file: ${absPath}\n${err}`, { cause: err });
  } finally {
    delete process.env['SWAIG_CLI_MODE'];
  }
}

/** Options for {@link loadAgent}. */
export interface LoadAgentOptions {
  /** The route of the service to use, when the file has several. */
  route?: string;
}

const routeOf = (obj: unknown): string | undefined => (obj as { route?: string } | null)?.route;

/** Routes compare without a trailing slash. */
const sameRoute = (a: string | undefined, b: string) =>
  a !== undefined && (a.replace(/\/+$/, '') || '/') === (b.replace(/\/+$/, '') || '/');

/**
 * Dynamically import an agent file and resolve an AgentBase instance using duck-typing heuristics.
 * @param agentPath - Path to the agent module file.
 * @param agentClass - Optional name of a specific exported class or instance to use.
 * @param opts - `route`: pick the service with this route.
 * @returns The resolved AgentBase instance.
 */
export async function loadAgent(
  agentPath: string,
  agentClass?: string,
  opts: LoadAgentOptions = {},
): Promise<unknown> {
  const { exports: mod, constructed } = await importModule(agentPath);

  // If a specific class name is requested
  if (agentClass) {
    const target = mod[agentClass];
    if (!target) {
      throw new Error(`Export '${agentClass}' not found in ${agentPath}`);
    }
    if (isService(target)) return target;
    if (isAgentClass(target)) {
      const Cls = target as new (opts: { name: string }) => unknown;
      return new Cls({ name: agentClass.toLowerCase() });
    }
    throw new Error(`Export '${agentClass}' is not an AgentBase instance or class`);
  }

  // Every service the file has, exported or only constructed.
  const candidates: unknown[] = [];
  for (const value of [...Object.values(mod), ...constructed]) {
    if (isService(value) && !candidates.includes(value)) candidates.push(value);
  }

  if (opts.route) {
    const match = candidates.find((s) => sameRoute(routeOf(s), opts.route!));
    if (match) return match;
    for (const value of Object.values(mod)) {
      if (!isAgentClass(value)) continue;
      const instance = new (value as new (o: { name: string }) => unknown)({ name: 'cli-agent' });
      if (sameRoute(routeOf(instance), opts.route)) return instance;
    }
    const routes = candidates.map(routeOf).filter(Boolean);
    throw new Error(
      `No service found with route '${opts.route}'` +
        (routes.length ? `. Available routes: ${routes.join(', ')}` : ''),
    );
  }

  // 1. Named export `agent`
  if (isAgentInstance(mod['agent'])) return mod['agent'];

  // 2. Default export (instance)
  if (isAgentInstance(mod['default'])) return mod['default'];

  // 3. Any exported AgentBase instance
  for (const key of Object.keys(mod)) {
    if (isAgentInstance(mod[key])) return mod[key];
  }

  // 4. Default export (class) - instantiate
  if (isAgentClass(mod['default'])) {
    const Cls = mod['default'] as new (opts: { name: string }) => unknown;
    return new Cls({ name: 'cli-agent' });
  }

  // 5. Any exported AgentBase subclass
  for (const key of Object.keys(mod)) {
    if (isAgentClass(mod[key])) {
      const Cls = mod[key] as new (opts: { name: string }) => unknown;
      return new Cls({ name: 'cli-agent' });
    }
  }

  // 6. An exported SWMLService
  if (isSWMLServiceInstance(mod['agent'])) return mod['agent'];
  for (const key of Object.keys(mod)) {
    if (isSWMLServiceInstance(mod[key])) return mod[key];
  }

  // 7. A service the file constructed without exporting it
  const unexported = constructed.filter(isService);
  if (unexported.length === 1) return unexported[0];
  if (unexported.length > 1) {
    throw new Error(
      `Multiple services found in ${resolve(agentPath)}; choose one with --route.\n` +
        `Available routes: ${unexported.map(routeOf).join(', ')}`,
    );
  }

  throw new Error(
    `Could not find an AgentBase or SWMLService instance in ${resolve(agentPath)}.\n` +
      'Export your agent as `export const agent = new AgentBase(...)` or as default export.',
  );
}

/** One service a file has, as {@link describeAgents} reports it. */
export interface AgentDescription {
  /** The export name, or the service's own name when it isn't exported. */
  name: string;
  /** Whether it's an instance or a class. */
  kind: 'instance' | 'class';
  /** The service's name, for an instance. */
  agentName?: string;
  /** The service's route, for an instance. */
  route?: string;
}

/**
 * Describe every service a file has: exported instances and classes, and
 * instances it constructed without exporting.
 * @param agentPath - Path to the agent module file.
 */
export async function describeAgents(agentPath: string): Promise<AgentDescription[]> {
  const { exports: mod, constructed } = await importModule(agentPath);
  const out: AgentDescription[] = [];
  const seen = new Set<unknown>();
  const describe = (name: string, value: unknown) => {
    const { name: agentName, route } = value as { name?: string; route?: string };
    out.push({ name, kind: 'instance', agentName, route });
    seen.add(value);
  };
  for (const [key, value] of Object.entries(mod)) {
    if (isService(value)) describe(key, value);
    else if (isAgentClass(value)) out.push({ name: key, kind: 'class' });
  }
  for (const value of constructed) {
    if (isService(value) && !seen.has(value)) {
      describe((value as { name?: string }).name ?? 'service', value);
    }
  }
  return out;
}

/**
 * List all exported agent instances and classes in a module.
 * @param agentPath - Path to the agent module file.
 * @returns Array of export names that are AgentBase instances or subclasses.
 */
export async function listAgents(agentPath: string): Promise<string[]> {
  return (await describeAgents(agentPath)).map((a) => a.name);
}
