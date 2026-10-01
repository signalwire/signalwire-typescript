/**
 * An agent serves HTTPS when SSL is configured (SWML_SSL_ENABLED with a
 * certificate and key), as the Python SDK's AgentBase.serve() does through
 * uvicorn's ssl_certfile/ssl_keyfile, and stop() closes the server it started.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import https from 'node:https';
import net from 'node:net';
import type { TLSSocket } from 'node:tls';
import { AgentBase } from '../../src/index.js';
import { resolveTlsCerts } from './support.js';

const certs = resolveTlsCerts();

function freeTcpPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
  });
}

function httpsGet(url: string, ca: Buffer): Promise<{ status: number; authorized: boolean }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { ca: [ca], rejectUnauthorized: true }, (res) => {
      const authorized = Boolean((res.socket as TLSSocket).authorized);
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode ?? 0, authorized }));
    });
    req.on('error', reject);
    req.setTimeout(5_000, () => req.destroy(new Error('timeout')));
  });
}

async function waitForPort(port: number): Promise<void> {
  for (let i = 0; i < 50; i++) {
    const open = await new Promise<boolean>((resolve) => {
      const sock = net.connect(port, '127.0.0.1', () => {
        sock.end();
        resolve(true);
      });
      sock.on('error', () => resolve(false));
    });
    if (open) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`port ${port} never opened`);
}

describe.skipIf(certs === null)('TLS: AgentBase serves HTTPS from the SSL settings', () => {
  const saved: Record<string, string | undefined> = {};
  const vars = ['SWML_SSL_ENABLED', 'SWML_SSL_CERT_PATH', 'SWML_SSL_KEY_PATH', 'SWAIG_CLI_MODE'];

  beforeEach(() => {
    for (const v of vars) saved[v] = process.env[v];
    delete process.env['SWAIG_CLI_MODE'];
    process.env['SWML_SSL_ENABLED'] = 'true';
    process.env['SWML_SSL_CERT_PATH'] = join(certs!, 'server.crt');
    process.env['SWML_SSL_KEY_PATH'] = join(certs!, 'server.key');
  });

  afterEach(() => {
    for (const v of vars) {
      if (saved[v] === undefined) delete process.env[v];
      else process.env[v] = saved[v];
    }
  });

  it('answers over verified TLS, and stop() closes the server', async () => {
    const port = await freeTcpPort();
    const agent = new AgentBase({
      name: 'tls',
      route: '/',
      host: '127.0.0.1',
      port,
      basicAuth: ['u', 'p'],
    });
    agent.setPromptText('hi');
    await agent.serve();
    try {
      await waitForPort(port);
      const res = await httpsGet(
        `https://127.0.0.1:${port}/health`,
        readFileSync(join(certs!, 'ca.crt')),
      );
      expect(res.status).toBe(200);
      expect(res.authorized).toBe(true);
    } finally {
      agent.stop();
    }
    // After stop() the port is free again.
    await new Promise((r) => setTimeout(r, 100));
    const reopened = net.createServer();
    await new Promise<void>((resolve, reject) => {
      reopened.once('error', reject);
      reopened.listen(port, '127.0.0.1', () => resolve());
    });
    reopened.close();
  });
});

describe.skipIf(certs === null)('TLS: AgentServer serves HTTPS from the SSL settings', () => {
  it('answers over verified TLS when SWML_SSL_ENABLED is "1"', async () => {
    const saved = [
      'SWML_SSL_ENABLED',
      'SWML_SSL_CERT_PATH',
      'SWML_SSL_KEY_PATH',
      'SWAIG_CLI_MODE',
    ].map((v) => [v, process.env[v]] as const);
    delete process.env['SWAIG_CLI_MODE'];
    process.env['SWML_SSL_ENABLED'] = '1';
    process.env['SWML_SSL_CERT_PATH'] = join(certs!, 'server.crt');
    process.env['SWML_SSL_KEY_PATH'] = join(certs!, 'server.key');
    const { AgentServer } = await import('../../src/index.js');
    const port = await freeTcpPort();
    const server = new AgentServer({ host: '127.0.0.1', port });
    const agent = new AgentBase({ name: 'tls', route: '/sales', basicAuth: ['u', 'p'] });
    agent.setPromptText('hi');
    server.register(agent);
    try {
      await server.run();
      await waitForPort(port);
      const res = await httpsGet(
        `https://127.0.0.1:${port}/health`,
        readFileSync(join(certs!, 'ca.crt')),
      );
      expect(res.status).toBe(200);
      expect(res.authorized).toBe(true);
    } finally {
      server._server?.close();
      for (const [v, val] of saved) {
        if (val === undefined) delete process.env[v];
        else process.env[v] = val;
      }
    }
  });
});
