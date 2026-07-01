import { describe, it, expect, vi } from 'vitest';
import {
  SwaigFunction,
  DEFAULT_SWAIG_ERROR_MESSAGE,
  type SwaigErrorContext,
} from '../src/SwaigFunction.js';
import { FunctionResult } from '../src/FunctionResult.js';

/** A handler that always throws, for exercising the error path. */
function throwingFn(name: string, err: unknown): SwaigFunction {
  return new SwaigFunction({
    name,
    description: 'always throws',
    parameters: {},
    handler: () => {
      throw err;
    },
  });
}

describe('SwaigFunction.execute error handling (#19371)', () => {
  it('still returns a valid FunctionResult dict (default message) when the handler throws', async () => {
    const fn = throwingFn('boom', new Error('kaboom'));
    const result = await fn.execute({});
    expect(result['response']).toBe(DEFAULT_SWAIG_ERROR_MESSAGE);
  });

  it('honors a per-tool errorMessage override', async () => {
    const fn = new SwaigFunction({
      name: 'boom',
      description: 'd',
      parameters: {},
      errorMessage: 'Custom failure text.',
      handler: () => {
        throw new Error('kaboom');
      },
    });
    const result = await fn.execute({});
    expect(result['response']).toBe('Custom failure text.');
  });

  it('invokes the per-tool onError hook with the error + context', async () => {
    const seen: { error: unknown; ctx: SwaigErrorContext }[] = [];
    const fn = new SwaigFunction({
      name: 'boom',
      description: 'd',
      parameters: {},
      onError: (error, ctx) => {
        seen.push({ error, ctx });
      },
      handler: () => {
        throw new Error('kaboom');
      },
    });
    await fn.execute({ city: 'Paris' }, undefined);
    expect(seen).toHaveLength(1);
    expect((seen[0]!.error as Error).message).toBe('kaboom');
    expect(seen[0]!.ctx.functionName).toBe('boom');
    expect(seen[0]!.ctx.args).toEqual({ city: 'Paris' });
  });

  it('lets a per-tool onError hook return a FunctionResult to control the response', async () => {
    const fn = new SwaigFunction({
      name: 'boom',
      description: 'd',
      parameters: {},
      onError: () => new FunctionResult('Handled by the tool hook.'),
      handler: () => {
        throw new Error('kaboom');
      },
    });
    const result = await fn.execute({});
    expect(result['response']).toBe('Handled by the tool hook.');
  });

  it('falls back to the agent-level onError when the tool has none', async () => {
    const fn = throwingFn('boom', new Error('kaboom'));
    const agentHook = vi.fn(() => new FunctionResult('Handled at agent level.'));
    const result = await fn.execute({}, undefined, agentHook);
    expect(agentHook).toHaveBeenCalledOnce();
    expect(result['response']).toBe('Handled at agent level.');
  });

  it('per-tool onError takes precedence over the agent-level hook', async () => {
    const agentHook = vi.fn(() => new FunctionResult('agent'));
    const fn = new SwaigFunction({
      name: 'boom',
      description: 'd',
      parameters: {},
      onError: () => new FunctionResult('tool'),
      handler: () => {
        throw new Error('kaboom');
      },
    });
    const result = await fn.execute({}, undefined, agentHook);
    expect(result['response']).toBe('tool');
    expect(agentHook).not.toHaveBeenCalled();
  });

  it('still returns the default message if a hook itself throws (error stays contained)', async () => {
    const fn = new SwaigFunction({
      name: 'boom',
      description: 'd',
      parameters: {},
      onError: () => {
        throw new Error('hook blew up too');
      },
      handler: () => {
        throw new Error('kaboom');
      },
    });
    const result = await fn.execute({});
    expect(result['response']).toBe(DEFAULT_SWAIG_ERROR_MESSAGE);
  });
});
