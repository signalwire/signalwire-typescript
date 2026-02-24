/**
 * Agent discovery via dynamic import for swaig-test CLI.
 *
 * Tries multiple strategies to find an AgentBase instance:
 * 1. Named export `agent`
 * 2. Default export
 * 3. Any exported AgentBase instance (duck-typed)
 * 4. Any exported AgentBase subclass (instantiated)
 */

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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
  const proto = (obj as any).prototype;
  if (!proto) return false;
  return (
    typeof proto['renderSwml'] === 'function' &&
    typeof proto['defineTool'] === 'function' &&
    typeof proto['getPrompt'] === 'function'
  );
}

export async function loadAgent(agentPath: string): Promise<unknown> {
  const absPath = resolve(agentPath);
  const fileUrl = pathToFileURL(absPath).href;

  let mod: Record<string, unknown>;
  try {
    mod = await import(fileUrl);
  } catch (err) {
    throw new Error(`Failed to import agent file: ${absPath}\n${err}`);
  }

  // 1. Named export `agent`
  if (mod['agent'] && isAgentInstance(mod['agent'])) {
    return mod['agent'];
  }

  // 2. Default export (instance)
  if (mod['default'] && isAgentInstance(mod['default'])) {
    return mod['default'];
  }

  // 3. Any exported AgentBase instance
  for (const key of Object.keys(mod)) {
    if (isAgentInstance(mod[key])) {
      return mod[key];
    }
  }

  // 4. Default export (class) - instantiate
  if (mod['default'] && isAgentClass(mod['default'])) {
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

  throw new Error(
    `Could not find an AgentBase instance or subclass in ${absPath}.\n` +
    'Export your agent as `export const agent = new AgentBase(...)` or as default export.',
  );
}
