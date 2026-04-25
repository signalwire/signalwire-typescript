/**
 * Serve helper — dispatch + round-trip.
 *
 * Unit tests mock `globalThis.Bun` to verify the runtime branches select the
 * right backend. Integration test spins up the real server (whatever the test
 * runtime is — Node via vitest, or Bun if `bun test` is used) and confirms a
 * request round-trips end-to-end, then shuts down cleanly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { serve } from '../src/serve.js';

describe('serve() dispatch', () => {
  const originalBun = (globalThis as { Bun?: unknown }).Bun;

  afterEach(() => {
    if (originalBun === undefined) {
      delete (globalThis as { Bun?: unknown }).Bun;
    } else {
      (globalThis as { Bun?: unknown }).Bun = originalBun;
    }
    vi.resetModules();
  });

  it('uses Bun.serve when globalThis.Bun is present', async () => {
    const bunServe = vi.fn().mockReturnValue({
      port: 1234,
      stop: vi.fn().mockResolvedValue(undefined),
    });
    (globalThis as { Bun?: unknown }).Bun = { serve: bunServe };

    // Re-import after mutating globalThis so runtime.ts re-evaluates isBun.
    vi.resetModules();
    const { serve: serveFresh } = await import('../src/serve.js');

    const handle = await serveFresh({
      fetch: () => new Response('ok'),
      port: 1234,
      hostname: '127.0.0.1',
    });

    expect(bunServe).toHaveBeenCalledOnce();
    expect(bunServe.mock.calls[0][0]).toMatchObject({ port: 1234, hostname: '127.0.0.1' });
    expect(handle.port).toBe(1234);
    expect(handle.url).toBe('http://127.0.0.1:1234');
    await handle.stop();
  });

  it('passes tls through to Bun.serve when provided', async () => {
    const bunServe = vi.fn().mockReturnValue({
      port: 1234,
      stop: vi.fn().mockResolvedValue(undefined),
    });
    (globalThis as { Bun?: unknown }).Bun = { serve: bunServe };

    vi.resetModules();
    const { serve: serveFresh } = await import('../src/serve.js');

    const handle = await serveFresh({
      fetch: () => new Response('ok'),
      port: 1234,
      hostname: '127.0.0.1',
      tls: { cert: 'CERT', key: 'KEY' },
    });

    expect(bunServe.mock.calls[0][0].tls).toEqual({ cert: 'CERT', key: 'KEY' });
    expect(handle.url).toBe('https://127.0.0.1:1234');
    await handle.stop();
  });

  it('omits tls key when not provided', async () => {
    const bunServe = vi.fn().mockReturnValue({
      port: 1234,
      stop: vi.fn().mockResolvedValue(undefined),
    });
    (globalThis as { Bun?: unknown }).Bun = { serve: bunServe };

    vi.resetModules();
    const { serve: serveFresh } = await import('../src/serve.js');

    await serveFresh({
      fetch: () => new Response('ok'),
      port: 1234,
      hostname: '127.0.0.1',
    });

    expect(bunServe.mock.calls[0][0]).not.toHaveProperty('tls');
  });
});

describe('serve() integration — HTTP round-trip', () => {
  let handle: Awaited<ReturnType<typeof serve>> | undefined;

  beforeEach(() => {
    // Ensure the Node branch runs regardless of test runner.
    delete (globalThis as { Bun?: unknown }).Bun;
  });

  afterEach(async () => {
    if (handle) {
      await handle.stop();
      handle = undefined;
    }
  });

  it('binds, serves a Hono app, and stops cleanly', async () => {
    const app = new Hono();
    app.get('/ping', (c) => c.json({ pong: true }));

    // Use a reasonably high, randomized port to avoid collisions with any
    // previous run that didn't shut down cleanly.
    const port = 30000 + Math.floor(Math.random() * 20000);

    handle = await serve({
      fetch: app.fetch,
      port,
      hostname: '127.0.0.1',
    });

    const res = await fetch(`http://127.0.0.1:${port}/ping`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pong: true });
    expect(handle.url).toBe(`http://127.0.0.1:${port}`);
  });
});
