/**
 * Runtime-branched HTTP serve helper.
 *
 * One call site, two backends: Bun.serve when running under Bun, otherwise
 * @hono/node-server. Both paths accept a Web-standard `(Request) => Response`
 * handler (Hono's `app.fetch` is exactly this shape) and return a uniform
 * {@link ServerHandle} for lifecycle control.
 *
 * This module is intentionally framework-agnostic so it can be reused by
 * AgentBase, SWMLService, and WebService without any of them importing
 * Bun/Node APIs directly.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { isBun } from './runtime.js';

/** Web-standard request handler — matches Hono's `app.fetch` signature. */
export type FetchHandler = (req: Request) => Response | Promise<Response>;

/** Options accepted by {@link serve}. */
export interface ServeOptions {
  /** Request handler — typically `app.fetch` from a Hono instance. */
  fetch: FetchHandler;
  /** TCP port to bind. */
  port: number;
  /** Hostname / interface to bind. */
  hostname: string;
  /** TLS material to enable HTTPS. `cert` and `key` are PEM strings. */
  tls?: { cert: string; key: string };
}

/** Handle returned by {@link serve} for graceful lifecycle management. */
export interface ServerHandle {
  /** Bound port. */
  port: number;
  /** `scheme://hostname:port` of the running server. */
  url: string;
  /**
   * Stop accepting new connections and drain in-flight requests.
   * Resolves once the listener has fully closed.
   */
  stop(): Promise<void>;
}

/**
 * Start an HTTP(S) server using the best adapter for the current runtime.
 *
 * - **Bun**: uses `Bun.serve()` — the native, zero-overhead path.
 * - **Node**: uses `@hono/node-server`'s `serve()` for HTTP and
 *   `node:https.createServer` + `getRequestListener` for HTTPS.
 *
 * @param opts - See {@link ServeOptions}.
 * @returns A {@link ServerHandle} once the server is listening.
 */
export async function serve(opts: ServeOptions): Promise<ServerHandle> {
  if (isBun) return serveBun(opts);
  return serveNode(opts);
}

/* ────────────────────────────── Bun branch ────────────────────────────── */

async function serveBun(opts: ServeOptions): Promise<ServerHandle> {
  const Bun = (globalThis as { Bun?: any }).Bun;
  const scheme = opts.tls ? 'https' : 'http';
  const server = Bun.serve({
    fetch: opts.fetch,
    port: opts.port,
    hostname: opts.hostname,
    ...(opts.tls ? { tls: opts.tls } : {}),
  });
  return {
    port: server.port,
    url: `${scheme}://${opts.hostname}:${server.port}`,
    async stop(): Promise<void> {
      // Bun's server.stop() drains; stop(true) force-closes. Default to drain.
      await server.stop();
    },
  };
}

/* ────────────────────────────── Node branch ───────────────────────────── */

async function serveNode(opts: ServeOptions): Promise<ServerHandle> {
  const scheme = opts.tls ? 'https' : 'http';
  const url = `${scheme}://${opts.hostname}:${opts.port}`;

  if (opts.tls) {
    const { createServer } = await import('node:https');
    const { getRequestListener } = await import('@hono/node-server');
    const listener = getRequestListener(opts.fetch);
    const server = createServer({ cert: opts.tls.cert, key: opts.tls.key }, listener);
    await new Promise<void>((resolve) => server.listen(opts.port, opts.hostname, resolve));
    return {
      port: opts.port,
      url,
      stop(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()));
        });
      },
    };
  }

  const { serve: honoServe } = await import('@hono/node-server');
  const server = honoServe({
    fetch: opts.fetch,
    port: opts.port,
    hostname: opts.hostname,
  }) as { close(cb: (err?: Error) => void): void };
  return {
    port: opts.port,
    url,
    stop(): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
