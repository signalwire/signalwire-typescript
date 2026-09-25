/**
 * native_vector_search remote mode: credentials in `remote_url` are sent as
 * basic auth and never logged, and ERROR logs carry no request details.
 *
 * Mirrors signalwire-python df3f032 and c2dda44 (B4, B25): a `remote_url` with
 * an empty user (`http://:SECRET@host`) used to keep its credentials in the
 * URL, so Node's fetch refused it with an error that quoted the whole URL,
 * which was then logged at ERROR.
 */

import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { NativeVectorSearchSkill } from '../../src/skills/builtin/index.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { setGlobalLogLevel, suppressAllLogs } from '../../src/Logger.js';

interface Captured {
  level: string;
  line: string;
}

/** Capture every console line the logger writes, with its level. */
function captureLogs(): { lines: Captured[]; restore: () => void } {
  const lines: Captured[] = [];
  const spies = (['error', 'warn', 'info', 'debug', 'log'] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      lines.push({
        level,
        line: args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '),
      });
    }),
  );
  return { lines, restore: () => spies.forEach((s) => s.mockRestore()) };
}

describe('native_vector_search remote credentials and logs', () => {
  let server: http.Server;
  let port = 0;
  const seenAuth: (string | undefined)[] = [];
  let searchStatus = 200;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      seenAuth.push(req.headers['authorization']);
      if (req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"status":"ok"}');
        return;
      }
      res.writeHead(searchStatus, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ results: [] }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    seenAuth.length = 0;
    searchStatus = 200;
    // The fixture server is on loopback.
    process.env['SWML_ALLOW_PRIVATE_URLS'] = 'true';
    suppressAllLogs(false);
    setGlobalLogLevel('debug');
  });

  afterEach(() => {
    delete process.env['SWML_ALLOW_PRIVATE_URLS'];
    setGlobalLogLevel('info');
    suppressAllLogs(true);
  });

  async function runSearch(remoteUrl: string, query: string) {
    const logs = captureLogs();
    try {
      const skill = new NativeVectorSearchSkill({ remote_url: remoteUrl });
      const ready = await skill.setup();
      const handler = skill.getTools()[0]!.handler;
      const result = (await handler({ query }, {})) as FunctionResult;
      return { ready, response: result.response, lines: logs.lines };
    } finally {
      logs.restore();
    }
  }

  it('sends an empty-user password as basic auth and never logs it', async () => {
    const { ready, lines } = await runSearch(
      `http://:SECRET-PW@127.0.0.1:${port}`,
      'where is the manual',
    );
    expect(ready).toBe(true);
    const expected = 'Basic ' + Buffer.from(':SECRET-PW').toString('base64');
    expect(seenAuth.length).toBeGreaterThan(0);
    expect(seenAuth.every((a) => a === expected)).toBe(true);
    expect(lines.some((l) => l.line.includes('SECRET-PW'))).toBe(false);
  });

  it('sends a user with no password as basic auth', async () => {
    const { ready } = await runSearch(`http://only-user@127.0.0.1:${port}`, 'q');
    expect(ready).toBe(true);
    const expected = 'Basic ' + Buffer.from('only-user:').toString('base64');
    expect(seenAuth.every((a) => a === expected)).toBe(true);
  });

  it("keeps the caller's query and the remote error out of ERROR logs", async () => {
    searchStatus = 500;
    const { lines } = await runSearch(
      `http://user:SECRET-PW@127.0.0.1:${port}`,
      'my account number is 4242',
    );
    const errors = lines.filter((l) => l.level === 'error');
    expect(errors.some((l) => l.line.includes('remote search failed'))).toBe(true);
    for (const l of errors) {
      expect(l.line).not.toContain('4242');
      expect(l.line).not.toContain('SECRET-PW');
    }
    expect(lines.some((l) => l.line.includes('SECRET-PW'))).toBe(false);
  });
});
